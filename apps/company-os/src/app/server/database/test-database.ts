import { PgClient } from "@effect/sql-pg"
import { Effect, Layer, Redacted } from "effect"

import { Model } from "#/app.model.ts"
import { applyMigrations } from "#/app/server/database/migrations.ts"
import { ModelContext } from "#/runtime/server/model-context.ts"
import { Database } from "#/runtime/server/storage/database.ts"
import { pgTypes } from "#/runtime/server/storage/index.ts"
import { TestDatabase as PostgresTestDatabase } from "#/runtime/server/storage/testing.ts"

async function migrate(url: string) {
  await Effect.runPromise(
    Effect.scoped(
      applyMigrations().pipe(
        Effect.provide(
          Database.layer.pipe(
            Layer.provideMerge(ModelContext.layer(Model)),
            Layer.provide(
              PgClient.layer({ url: Redacted.make(url), types: pgTypes })
            )
          )
        )
      )
    )
  )
}

/** Application tests use real migrations and the application's transaction hooks. */
export const TestDatabase = {
  ...PostgresTestDatabase,
  createTemplate: (schema?: string) =>
    PostgresTestDatabase.createTemplate(schema ?? migrate),
  layer: (template: Parameters<typeof PostgresTestDatabase.layer>[0]) =>
    Database.layer.pipe(
      Layer.provideMerge(ModelContext.layer(Model)),
      Layer.provide(PostgresTestDatabase.layer(template))
    ),
}
