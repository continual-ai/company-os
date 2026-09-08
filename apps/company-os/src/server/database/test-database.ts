import { Database } from "@company/runtime/server/database/database"
import { ModelContext } from "@company/runtime/server/model-context"
import { pgTypes } from "@company/runtime/server/postgres"
import { TestDatabase as PostgresTestDatabase } from "@company/runtime/testing"
import { PgClient } from "@effect/sql-pg"
import { Effect, Layer, Redacted } from "effect"

import { Model } from "#/examples/model.ts"
import { applyMigrations } from "#/examples/schema.server.ts"

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
