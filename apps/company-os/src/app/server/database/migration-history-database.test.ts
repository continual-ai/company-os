import { Effect, Exit, Layer } from "effect"
import { expect, it } from "vitest"

import { Model } from "#/app.model.ts"
import {
  applyMigrations,
  verifyDatabaseModel,
} from "#/app/server/database/migrations.ts"
import {
  applySchemaMigrations,
  schemaHash,
  verifySchemaMigrations,
} from "#/runtime/server/migrations.ts"
import { ModelContext } from "#/runtime/server/model-context.ts"
import { Database } from "#/runtime/server/storage/database.ts"
import { TestDatabase } from "#/runtime/server/storage/testing.ts"

it("boots the app from its committed baseline and rejects migration drift", async () => {
  const template = await TestDatabase.createTemplate("")
  try {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          expect(
            Exit.isFailure(yield* verifyDatabaseModel().pipe(Effect.exit))
          ).toBe(true)
          yield* applyMigrations()
          yield* verifyDatabaseModel()
          const { sql } = yield* Database
          expect(
            yield* sql`select to_regclass('objects')::text as registry`
          ).toEqual([{ registry: "objects" }])
        }).pipe(
          Effect.provide(
            Database.layer.pipe(
              Layer.provideMerge(ModelContext.layer(Model)),
              Layer.provide(TestDatabase.layer(template))
            )
          )
        )
      )
    )
  } finally {
    await TestDatabase.drop(template)
  }
})

it("keeps applied SQL immutable and evolves retained rows through numbered migrations", async () => {
  const template = await TestDatabase.createTemplate("")
  const first = {
    id: 1,
    name: "initial",
    sql: "create table probe (id integer primary key, name text not null);",
    schemaHash: schemaHash("first"),
  }
  const second = {
    id: 2,
    name: "add_priority",
    sql: "alter table probe add column priority text not null default 'normal';",
    schemaHash: schemaHash("second"),
  }
  try {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const { sql } = yield* Database
          yield* applySchemaMigrations([first], first.schemaHash)
          yield* sql`insert into probe values (1, 'Retain me')`
          expect(
            Exit.isFailure(
              yield* verifySchemaMigrations(
                [first, second],
                second.schemaHash
              ).pipe(Effect.exit)
            )
          ).toBe(true)
          expect(
            Exit.isFailure(
              yield* applySchemaMigrations(
                [{ ...first, sql: first.sql + "select 1;" }],
                first.schemaHash
              ).pipe(Effect.exit)
            )
          ).toBe(true)
          expect(
            Exit.isFailure(
              yield* applySchemaMigrations([first], second.schemaHash).pipe(
                Effect.exit
              )
            )
          ).toBe(true)
          yield* applySchemaMigrations([first, second], second.schemaHash)
          yield* applySchemaMigrations([first, second], second.schemaHash)
          expect(yield* sql`select * from probe`).toEqual([
            { id: 1, name: "Retain me", priority: "normal" },
          ])
        }).pipe(
          Effect.provide(
            Database.layer.pipe(
              Layer.provideMerge(ModelContext.layer(Model)),
              Layer.provide(TestDatabase.layer(template))
            )
          )
        )
      )
    )
  } finally {
    await TestDatabase.drop(template)
  }
})
