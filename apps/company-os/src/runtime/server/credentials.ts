import { Context, Data, Effect, Layer, type Redacted } from "effect"

import type { ObjectType } from "#/runtime/model/index.ts"
import { requireProjectAccess } from "#/runtime/server/auth/project-access.ts"
import { ModelContext } from "#/runtime/server/model-context.ts"
import {
  mapSecrets,
  RecordSecrets,
} from "#/runtime/server/storage/record-secrets.ts"
import { tableColumns } from "#/runtime/server/storage/table.ts"
import { SqlDatabase } from "#/runtime/server/storage/transactions.ts"

export class CredentialError extends Data.TaggedError("CredentialError")<{
  readonly message: string
}> {}

const make = Effect.gen(function* () {
  const context = yield* ModelContext
  const { sql } = yield* SqlDatabase
  const secrets = yield* RecordSecrets
  const get = Effect.fn("Credentials.get")(function* (
    object: ObjectType,
    id: string,
    path: string | ReadonlyArray<string>
  ) {
    yield* requireProjectAccess
    const parts = typeof path === "string" ? [path] : path
    const property = parts[0]
    const schema =
      property === undefined ? undefined : object.properties[property]
    if (!context.installed(object) || !schema || !property)
      return yield* Effect.fail(
        new CredentialError({ message: "Unknown credential field." })
      )
    const table = context.table(object)
    const columns = tableColumns(table)
    const rows = yield* sql<{
      value: unknown
    }>`select ${columns[property]} as value from ${table} where ${columns.id} = ${id}`
    const row = rows[0]
    if (!row || row.value === null) return undefined
    return yield* Effect.try({
      try: () => {
        let result: Redacted.Redacted | undefined
        mapSecrets(schema, row.value, [property], (value, currentPath) => {
          if (JSON.stringify(currentPath) === JSON.stringify(parts))
            result = secrets.decrypt(object, id, parts, value)
          return value
        })
        return result
      },
      catch: () =>
        new CredentialError({
          message: "Unable to read protected credential.",
        }),
    })
  })
  return { get }
})

/** Explicit server-only decryption. Set, replace, and clear secrets through ordinary record writes. */
export class Credentials extends Context.Service<Credentials>()(
  "@company/Credentials",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
