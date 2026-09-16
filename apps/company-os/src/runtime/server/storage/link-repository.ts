import { Effect } from "effect"

import type { LinkDirection, ModelCatalog } from "#/runtime/model/index.ts"
import { LinkCardinalityConflict } from "#/runtime/server/errors.ts"
import {
  linkStorage,
  type LinkStorage,
} from "#/runtime/server/storage/link-storage.ts"
import type { PostgresStorage } from "#/runtime/server/storage/schema.ts"
import {
  projection,
  type SelectionRow,
} from "#/runtime/server/storage/statement.ts"
import {
  quoteIdentifier,
  tableColumns,
  type Column,
  type Table,
} from "#/runtime/server/storage/table.ts"
import { type PostgresDatabase } from "#/runtime/server/storage/transactions.ts"

export interface LinkPair {
  readonly direction: LinkDirection
  readonly linkId: string
  readonly sourceId: string
  readonly targetId: string
}

/** Normalize either traversal direction to the stored edge's endpoints. */
export function linkPairEndpoints(pair: LinkPair) {
  return {
    forwardId: pair.direction === "forward" ? pair.sourceId : pair.targetId,
    reverseId: pair.direction === "reverse" ? pair.sourceId : pair.targetId,
  }
}

/** One edge explicitly inserted or removed by a mutation. */
interface LinkChange {
  readonly kind: "linked" | "unlinked"
  readonly linkId: string
  readonly forwardId: string
  readonly reverseId: string
}

type LinkTable = Table<{ forwardId: string; reverseId: string }>

function linkColumn(
  table: LinkTable,
  key: "forwardId" | "reverseId"
): Column<string> {
  const value = tableColumns(table)[key]
  if (value === undefined) {
    throw new Error(`Link storage column '${key}' is missing.`)
  }
  return value
}

/**
 * Builds the PostgreSQL edge repository for every Link in one closed model.
 * Mutations report exactly the edges they changed so callers can journal them;
 * they assume the caller holds the transaction and any row locks.
 */
export function makeLinkRepository<const TModel extends ModelCatalog>(
  storage: PostgresStorage<TModel>,
  db: PostgresDatabase
) {
  const sql = db.sql
  const definition = (linkId: string) => {
    const link = storage.model.links[linkId]
    // SAFETY: PostgresStorage materializes each model Link as a Table.
    const table = storage.linkTables[linkId] as LinkTable | undefined
    if (link === undefined || table === undefined) {
      throw new Error(`Link '${linkId}' does not have PostgreSQL storage.`)
    }
    return { link, table }
  }
  const applyForeignKey = Effect.fn(
    "@company/runtime/storage/LinkRepository.applyForeignKey"
  )(function* (
    plan: Extract<LinkStorage, { kind: "foreignKey" }>,
    pair: LinkPair,
    operation: "link" | "unlink"
  ) {
    const { forwardId, reverseId } = linkPairEndpoints(pair)
    const ownerId = plan.side === "forward" ? forwardId : reverseId
    const targetId = plan.side === "forward" ? reverseId : forwardId
    const owner =
      storage.objects[plan.ownerType] ?? storage.interfaces[plan.ownerType]
    if (!owner)
      return yield* Effect.die(`Missing FK owner '${plan.ownerType}'.`)
    const column = sql.literal(quoteIdentifier(plan.column))
    if (operation === "link") {
      const [existing] = yield* sql<{
        target: string | null
      }>`select ${column} as target from ${owner} where id = ${ownerId} for update`
      if (!existing)
        return yield* Effect.die(`Missing relationship owner ${ownerId}.`)
      if (existing.target === targetId) return []
      if (existing.target !== null)
        return yield* Effect.fail(
          new LinkCardinalityConflict({
            linkId: pair.linkId,
            sourceId: pair.sourceId,
            targetId: pair.targetId,
          })
        )
      yield* sql`update ${owner} set ${column} = ${targetId} where id = ${ownerId}`
    } else {
      const rows =
        yield* sql`update ${owner} set ${column} = null where id = ${ownerId} and ${column} = ${targetId} returning id`
      if (rows.length === 0) return []
    }
    return [
      {
        kind: operation === "link" ? "linked" : "unlinked",
        linkId: pair.linkId,
        forwardId,
        reverseId,
      } satisfies LinkChange,
    ]
  })

  const ids = (pair: Omit<LinkPair, "targetId">) => {
    const { table } = definition(pair.linkId)
    const source = linkColumn(
      table,
      pair.direction === "forward" ? "forwardId" : "reverseId"
    )
    const target = linkColumn(
      table,
      pair.direction === "forward" ? "reverseId" : "forwardId"
    )
    return sql<{
      id: string
    }>`select ${target} as id from ${table} where ${source} = ${pair.sourceId} order by ${target}`.pipe(
      Effect.map((rows) => rows.map((row) => row.id))
    )
  }
  /** All endpoints are already locked by the writer; join-table deltas use one statement per Link and operation. */
  const apply = Effect.fn("@company/runtime/storage/LinkRepository.apply")(
    function* (
      mutations: ReadonlyArray<
        LinkPair & { readonly operation: "link" | "unlink" }
      >
    ) {
      const changes: LinkChange[] = []
      const groups = new Map<string, Array<(typeof mutations)[number]>>()
      for (const mutation of mutations) {
        const key = `${mutation.linkId}:${mutation.operation}`
        const group = groups.get(key) ?? []
        group.push(mutation)
        groups.set(key, group)
      }
      for (const group of groups.values()) {
        const first = group[0]!
        const { table, link: linkDefinition } = definition(first.linkId)
        const plan = linkStorage(linkDefinition)
        if (plan.kind === "foreignKey") {
          for (const pair of group)
            changes.push(
              ...(yield* applyForeignKey(plan, pair, pair.operation))
            )
          continue
        }
        const pairs = [
          ...new Map(
            group.map((pair) => {
              const { forwardId, reverseId } = linkPairEndpoints(pair)
              return [
                JSON.stringify([forwardId, reverseId]),
                { forwardId, reverseId },
              ]
            })
          ).values(),
        ]
        const values = sql.join(
          ", ",
          false
        )(
          pairs.map(
            (pair) => sql`(${pair.forwardId}::text, ${pair.reverseId}::text)`
          )
        )
        const fields = {
          forwardId: table.columns.forwardId,
          reverseId: table.columns.reverseId,
        }
        const rows =
          first.operation === "link"
            ? yield* sql<
                SelectionRow<typeof fields>
              >`insert into ${table} (forward_id, reverse_id) values ${values} on conflict do nothing returning ${projection(fields)}`
            : yield* sql<
                SelectionRow<typeof fields>
              >`delete from ${table} where (forward_id, reverse_id) in (values ${values}) returning ${projection(fields)}`
        for (const row of rows)
          changes.push({
            ...row,
            linkId: first.linkId,
            kind: first.operation === "link" ? "linked" : "unlinked",
          })
      }
      return changes
    }
  )
  return { ids, apply }
}
