import { it, type Vitest } from "@effect/vitest"
import { Effect } from "effect"
import type * as Scope from "effect/Scope"
import { inject } from "vitest"

import { TestDatabase } from "#/app/server/database/test-database.ts"
import type { ModelContext } from "#/runtime/server/model-context.ts"
import type { Database } from "#/runtime/server/storage/database.ts"

/** Runs an Effect test against a fresh clone of the migrated PostgreSQL template. */
export const itDatabase: Vitest.Test<Database | ModelContext | Scope.Scope> = (
  name,
  test,
  options
) =>
  it.effect(
    name,
    (context) =>
      test(context).pipe(
        Effect.provide(TestDatabase.layer(inject("testDatabaseTemplate")))
      ),
    options
  )
