import type { Database } from "@company/runtime/server/database/database"
import type { ModelContext } from "@company/runtime/server/model-context"
import { it, type Vitest } from "@effect/vitest"
import { Effect } from "effect"
import type * as Scope from "effect/Scope"
import { inject } from "vitest"

import { TestDatabase } from "#/server/database/test-database.ts"

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
