import { Effect } from "effect"
import type { SqlError } from "effect/unstable/sql/SqlError"

import {
  RecordId,
  type RecordAlias,
  type RecordRef,
  type ModelCatalog,
  type ModelRecordRef,
} from "#/runtime/model/index.ts"
import { RecordAliasNotFound } from "#/runtime/server/errors.ts"
import type { PostgresStorage } from "#/runtime/server/storage/schema.ts"
import {
  projection,
  type SelectionRow,
  inValues,
} from "#/runtime/server/storage/statement.ts"
import { type PostgresDatabase } from "#/runtime/server/storage/transactions.ts"

export type PostgresRecordAliasResolutionError = RecordAliasNotFound | SqlError

function makeRecordRef<const TObjectType extends string>(
  objectType: TObjectType,
  id: string
): RecordRef<TObjectType> {
  const dynamicObjectType: string = objectType
  const reference = { id: RecordId(dynamicObjectType)(id), objectType }
  // SAFETY: RecordRef distributes over object-type unions; this helper keeps
  // the validated branded ID paired with its object-type discriminator.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return reference as RecordRef<TObjectType>
}

/** Resolves globally unique aliases in input order without requiring object types. */
export function resolveRecordAliases<const TModel extends ModelCatalog>(
  storage: PostgresStorage<TModel>,
  db: PostgresDatabase,
  aliases: ReadonlyArray<RecordAlias>
): Effect.Effect<
  ReadonlyArray<ModelRecordRef<TModel>>,
  PostgresRecordAliasResolutionError
> {
  if (aliases.length === 0) return Effect.succeed([])
  const sql = db.sql
  const { recordAliases, objects } = storage.core
  return Effect.gen(function* () {
    const rowsFields = {
      alias: recordAliases.columns.alias,
      id: objects.columns.id,
      objectType: objects.columns.objectType,
    }
    const rows = yield* sql<
      SelectionRow<typeof rowsFields>
    >`select ${projection(rowsFields)}
          from ${recordAliases}
          inner join ${objects} on ${recordAliases.columns.objectId} = ${objects.columns.id}
          where ${inValues(sql, recordAliases.columns.alias, [...new Set(aliases)])}`
    const byAlias = new Map(rows.map((row) => [row.alias, row]))
    const references: Array<ModelRecordRef<TModel>> = []
    for (const alias of aliases) {
      const resolved = byAlias.get(alias)
      if (resolved === undefined) {
        return yield* Effect.fail(new RecordAliasNotFound({ alias }))
      }
      if (!Object.hasOwn(storage.model.objects, resolved.objectType)) {
        return yield* Effect.die(
          `Alias '${alias}' resolved to unknown object type '${resolved.objectType}'.`
        )
      }
      references.push(
        // The discriminator is a model object and the ID has been validated above.
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion
        makeRecordRef(
          resolved.objectType,
          resolved.id
        ) as ModelRecordRef<TModel>
      )
    }
    return references
  })
}
