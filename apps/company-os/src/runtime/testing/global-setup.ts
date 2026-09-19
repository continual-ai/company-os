import { randomUUID } from "node:crypto"

import { Effect } from "effect"
import type { TestProject } from "vitest/node"

import { TestDatabase } from "#/runtime/server/storage/testing.ts"

/** Concurrent invocations own independent templates, clones, and cleanup. */
export default async function setup(project: TestProject) {
  const runId = randomUUID().replaceAll("-", "").slice(0, 12)
  project.config.env = { ...project.config.env, COMPANY_OS_TEST_RUN_ID: runId }
  // Fail once during setup if the administrative connection is unavailable.
  await Effect.runPromise(TestDatabase.dropAll(runId))
  return () => Effect.runPromise(TestDatabase.dropAll(runId))
}
