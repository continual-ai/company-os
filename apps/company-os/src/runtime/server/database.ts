import { Context, Effect, Layer } from "effect"
import type { SqlError } from "effect/unstable/sql/SqlError"

import type { ObjectType } from "#/runtime/model/index.ts"
import type {
  ObjectUniqueConflict,
  ObjectCheckFailed,
} from "#/runtime/server/errors.ts"
import { ModelContext } from "#/runtime/server/model-context.ts"
import {
  RecordRepositories,
  type Repository,
} from "#/runtime/server/repository.ts"
import {
  SqlDatabase,
  type PostgresDatabase,
} from "#/runtime/server/storage/transactions.ts"

interface DatabaseService extends Omit<PostgresDatabase, "transaction"> {
  readonly table: typeof ModelContext.Service.table
  readonly repository: <O extends ObjectType>(object: O) => Repository<O>
  readonly transaction: <A, E, R>(
    body: (database: DatabaseService) => Effect.Effect<A, E, R>,
    options?: Parameters<PostgresDatabase["transaction"]>[1]
  ) => Effect.Effect<
    A,
    E | SqlError | ObjectUniqueConflict | ObjectCheckFailed,
    R
  >
}

const make = Effect.gen(function* () {
  const sql = yield* SqlDatabase
  const context = yield* ModelContext
  const repositories = yield* RecordRepositories
  const database: DatabaseService = {
    ...sql,
    transaction: (body, options) =>
      sql.transaction(() => body(database), options),
    table: (object) => context.table(object),
    repository: <O extends ObjectType>(object: O): Repository<O> =>
      repositories.get(object).repository,
  }
  return database
})

/** Model-aware persistence. Repositories validate, attribute, and commit records and links together. */
export class Database extends Context.Service<Database>()("@company/Database", {
  make,
}) {
  static readonly layer = Layer.effect(this, this.make)
}
