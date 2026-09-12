import { Config, Effect } from "effect"
import { expect, it } from "vitest"

import {
  migrationDraft,
  previewMigration,
} from "#/app/server/database/migration-diff.ts"

it("ignores physical column order but reports changed storage contracts", async () => {
  const history = [
    {
      id: 1,
      name: "initial",
      sql: "create table records (id text primary key, existing text); alter table records add column added text;",
    },
  ]
  const url = await Effect.runPromise(
    Config.string("DATABASE_URL").pipe(
      Config.withDefault("postgresql://localhost:5433/postgres")
    )
  )
  expect(
    await previewMigration(
      url,
      history,
      "create table records (id text primary key, added text, existing text);"
    )
  ).toEqual([])
  const hints = await previewMigration(
    url,
    history,
    "create table records (id text primary key, added integer, existing text);"
  )
  expect(hints).toHaveLength(2)
  expect(hints[0]).toContain('"type":"text"')
  expect(hints[1]).toContain('"type":"integer"')
  await expect(
    previewMigration(
      url,
      [...history, { id: 2, name: "unfinished", sql: migrationDraft(hints) }],
      ""
    )
  ).rejects.toThrow("Unfinished migration")
})
