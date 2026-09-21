import { Effect } from "effect"
import type { Constructor, Fragment } from "effect/unstable/sql/Statement"

import {
  modelObjectLinkTraversals,
  modelTypeAccepts,
  type ObjectType,
} from "#/runtime/model/index.ts"
import type { EventSubject } from "#/runtime/server/events/event-buffer.ts"
import type { ModelContext } from "#/runtime/server/model-context.ts"
import {
  insertValues,
  assignments,
  type Column,
  tableColumns,
  tableProjection,
  type TableRow,
  conflictColumns,
  type PostgresDatabase,
} from "#/runtime/server/storage/index.ts"
import {
  recordSearch,
  searchIndexState,
} from "#/runtime/server/storage/infrastructure.ts"
import { recordLabelSql } from "#/runtime/server/storage/record-label.ts"
import { searchVector } from "#/runtime/server/storage/search-query.ts"

function project(
  sql: Constructor,
  object: ObjectType,
  where: Fragment,
  context: typeof ModelContext.Service
) {
  const table = context.table(object)
  const columns: Readonly<Record<string, Column>> = tableColumns(table)
  const display = (field: string | undefined) =>
    field === undefined ? sql`null` : sql`${columns[field]}`
  const title = recordLabelSql(sql, context.storage, object)
  const vectors = object.search!.fields.map((field) => {
    const vector = searchVector(sql, sql`${columns[field]}`)
    return field === object.display.title
      ? sql`setweight(${vector}, 'A')`
      : sql`setweight(${vector}, 'B')`
  })
  if (object.display.titleFields)
    vectors.push(sql`setweight(${searchVector(sql, title)}, 'A')`)
  return sql`insert into ${recordSearch} (id, title, subtitle, image, status, document)
    select ${table.columns.id}, left(${title}, 300), left(${display(object.display.subtitle)}::text, 300),
      ${display(object.display.image)}::jsonb, ${display(object.display.status)}::text,
      ${sql.join(" || ")(vectors)}

          from ${table}
          where ${where}
          order by ${table.columns.id}

          on conflict (id)
          do update set title = excluded.title, subtitle = excluded.subtitle,
      image = excluded.image, status = excluded.status, document = excluded.document`
}

/** Called inside the writing transaction, including custom SQL facts. Deletions cascade from objects. */
export function updateSearchIndex(
  database: PostgresDatabase,
  changes: {
    readonly records: ReadonlyArray<EventSubject>
    readonly links?: ReadonlyArray<EventSubject>
  },
  context: typeof ModelContext.Service
) {
  const sql = database.sql
  const objects = context.storage.core.objects
  const searchableObjects = Object.values(context.model.objects).filter(
    (object) => object.search !== undefined
  )

  return Effect.gen(function* () {
    const subjects = [
      ...new Map(
        changes.records.map((subject) => [subject.id, subject])
      ).values(),
    ]
    // Link changes affect the endpoint's own derived title, not every sibling that refers to it.
    const affected = [
      ...subjects,
      ...(changes.links ?? []).filter((subject) =>
        context.model.objects[subject.objectType]?.display.titleFields?.some(
          (path) => path.includes(".")
        )
      ),
    ]
    // Derived titles depend only on direct singular links. Refresh those index rows when a target changes.
    for (const object of searchableObjects) {
      const keys = new Set(
        (object.display.titleFields ?? [])
          .filter((path) => path.includes("."))
          .map((path) => path.split(".")[0])
      )
      for (const { link, traversal, direction } of modelObjectLinkTraversals(
        context.model,
        object
      )) {
        if (!keys.has(traversal.key)) continue
        const ids = subjects
          .filter((subject) =>
            modelTypeAccepts(
              context.model,
              subject.objectType,
              traversal.to.typeId
            )
          )
          .map(({ id }) => id)
        if (ids.length === 0) continue
        const edges = context.storage.linkTables[link.id]!
        const source =
          direction === "forward"
            ? edges.columns.forwardId
            : edges.columns.reverseId
        const target =
          direction === "forward"
            ? edges.columns.reverseId
            : edges.columns.forwardId
        const rows = yield* sql<{
          id: string
        }>`select ${source} as id from ${edges} where ${target} in (${sql.csv(ids.map((id) => sql`${id}`))})`
        affected.push(...rows.map(({ id }) => ({ id, objectType: object.id })))
      }
    }
    const searchableTypes = new Set<string>(
      searchableObjects.map((object) => object.id)
    )
    const targets = [
      ...new Set(
        affected
          .filter((subject) => searchableTypes.has(subject.objectType))
          .map((subject) => subject.id)
      ),
    ].sort()
    if (targets.length === 0) return
    // Serialize projections with business writers so a related fact cannot publish an older snapshot.
    yield* sql`select id
          from ${objects}
          where id in (${sql.join(", ", false)(targets.map((id) => sql`${id}`))})
          order by id for no key update`
    for (const object of searchableObjects) {
      const ids = [
        ...new Set(
          affected
            .filter((subject) => subject.objectType === object.id)
            .map((subject) => subject.id)
        ),
      ].sort()
      if (ids.length === 0) continue
      const table = context.table(object)
      yield* sql`${project(
        sql,
        object,
        sql`${table.columns.id} in (${sql.join(", ", false)(ids.map((id) => sql`${id}`))})`,
        context
      )}`
    }
  })
}

/** Migration-time rebuild when indexed fields change. Locks source tables while replacing the disposable projection. */
export function ensureSearchIndex(
  database: PostgresDatabase,
  context: typeof ModelContext.Service,
  force = false
) {
  const sql = database.sql
  const objects = context.storage.core.objects
  const searchableObjects = Object.values(context.model.objects).filter(
    (object) => object.search !== undefined
  )

  const definition = JSON.stringify({
    version: 2,
    objects: searchableObjects.map((object) => ({
      id: object.id,
      collection: object.collection,
      search: object.search,
      display: object.display,
    })),
  })

  return Effect.gen(function* () {
    const [current] = yield* sql<
      TableRow<typeof searchIndexState>
    >`select ${tableProjection(searchIndexState)}
          from ${searchIndexState}
          where ${searchIndexState.columns.id} = ${1}`
    if (!force && current?.definition === definition) return
    yield* database.transaction(() =>
      Effect.gen(function* () {
        // Migration maintenance briefly pauses writers; readers continue seeing the old committed index.
        // Lock sources before the projection so a rebuild cannot overwrite a concurrent business write.
        const tables = [
          objects,
          ...searchableObjects.map((object) => context.table(object)),
          recordSearch,
          searchIndexState,
        ]
        yield* sql`lock table ${sql.join(", ", false)(tables)} in share row exclusive mode`
        const [locked] = yield* sql<
          TableRow<typeof searchIndexState>
        >`select ${tableProjection(searchIndexState)}
          from ${searchIndexState}
          where ${searchIndexState.columns.id} = ${1}`
        if (!force && locked?.definition === definition) return
        yield* sql`delete
          from ${recordSearch}`
        for (const object of searchableObjects)
          yield* sql`${project(sql, object, sql`true`, context)}`
        yield* sql`insert into ${searchIndexState} ${insertValues(sql, searchIndexState, { id: 1, definition })}
          on conflict (${conflictColumns(sql, searchIndexState.columns.id)})
          do update set ${assignments(sql, searchIndexState, { definition })}`
      })
    )
  })
}
