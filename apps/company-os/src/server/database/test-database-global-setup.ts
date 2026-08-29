import type { TestProject } from "vitest/node"

import { TestDatabase } from "./test-database"

export default async function setup(project: TestProject) {
  const template = await TestDatabase.createTemplate()
  project.provide("testDatabaseTemplate", template)
  return () => TestDatabase.drop(template)
}
