import { Effect } from "effect"

import { TestDatabase } from "#/runtime/server/storage/testing.ts"

/**
 * Clears templates and clones left by earlier runs, fails once with the
 * configuration message when PostgreSQL is unreachable, and drops the shared
 * templates this run creates.
 */
export default async function setup() {
  await Effect.runPromise(TestDatabase.dropAll)
  return () => Effect.runPromise(TestDatabase.dropAll)
}
