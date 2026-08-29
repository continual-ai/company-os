import { it, type Vitest } from "@effect/vitest"
import { Effect } from "effect"
import type * as Scope from "effect/Scope"
import { inject } from "vitest"

import type { Database } from "./database"
import { TestDatabase } from "./test-database"

/** Runs an Effect test against a fresh clone of the migrated PostgreSQL template. */
export const itDatabase: Vitest.Test<Database | Scope.Scope> = (
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
