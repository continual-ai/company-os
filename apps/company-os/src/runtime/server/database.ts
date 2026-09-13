import { Context, Effect, Layer } from "effect"
import type { SqlError } from "effect/unstable/sql/SqlError"

import type { ObjectType } from "#/runtime/model/index.ts"
import type {
  ObjectUniqueConflict,
  ObjectCheckFailed,
} from "#/runtime/server/errors.ts"
import { ModelContext } from "#/runtime/server/model-context.ts"
import { makeRepository, type Repository } from "#/runtime/server/repository.ts"
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
  const entries = yield* Effect.forEach(
    Object.values(context.model.objects),
    (object) =>
      makeRepository(object).pipe(
        Effect.map((repository) => [object.id, repository] as const)
      )
  )
  const repositories = new Map(entries)
  const database: DatabaseService = {
    ...sql,
    transaction: (body, options) =>
      sql.transaction(() => body(database), options),
    table: (object) => context.table(object),
    repository: <O extends ObjectType>(object: O): Repository<O> => {
      const repository = repositories.get(object.id)
      if (!context.installed(object) || repository === undefined)
        throw new Error(`Object '${object.id}' is not installed.`)
      // SAFETY: the repository was constructed from this exact installed object definition.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      return repository as unknown as Effect.Success<
        ReturnType<typeof makeRepository<O>>
      >
    },
  }
  return database
})

/** Model-aware persistence. Repositories validate, attribute, and commit records and links together. */
export class Database extends Context.Service<Database>()("@company/Database", {
  make,
}) {
  static readonly layer = Layer.effect(this, this.make)
}
