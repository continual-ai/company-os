import { Context, Effect } from "effect"

import type { PostgresDatabase } from "#/runtime/server/storage/transactions.ts"

const ReadOnlyOperation = Context.Reference<boolean>(
  "@company/ReadOnlyOperation",
  {
    defaultValue: () => false,
  }
)

/** A Query cannot acquire write privileges by calling an Action or a repository. */
export const requireWritableOperation = Effect.gen(function* () {
  if (yield* ReadOnlyOperation)
    return yield* Effect.die("Queries cannot write records, Links, or events.")
  return undefined
})

export function runOperation<A, E, R>(
  database: PostgresDatabase,
  kind: "query" | "action",
  operation: Effect.Effect<A, E, R>
) {
  if (kind === "action")
    return requireWritableOperation.pipe(
      Effect.andThen(database.transaction(() => operation))
    )
  return database
    .transaction(() => operation, {
      accessMode: "read only",
      isolationLevel: "repeatable read",
    })
    .pipe(Effect.provideService(ReadOnlyOperation, true))
}
