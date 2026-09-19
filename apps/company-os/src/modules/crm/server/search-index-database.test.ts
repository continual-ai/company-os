import { Effect } from "effect"
import { expect } from "vitest"

import { Account } from "#/modules/crm/model/account.ts"
import { Affiliation } from "#/modules/crm/model/affiliation.ts"
import { Contact } from "#/modules/crm/model/contact.ts"
import { CrmModule } from "#/modules/crm/model/index.ts"
import { CrmServer } from "#/modules/crm/server/index.ts"
import { defineModel } from "#/runtime/model/index.ts"
import { PlatformModule } from "#/runtime/platform/model/index.ts"
import { Database } from "#/runtime/server/database.ts"
import { recordSearch } from "#/runtime/server/storage/infrastructure.ts"
import { testFoundation } from "#/runtime/testing/foundation.ts"

const fixture = testFoundation(
  defineModel({
    name: "Search dependencies",
    modules: [PlatformModule, CrmModule],
  }),
  { servers: [CrmServer] }
)

fixture.test(
  "linking another child does not rewrite sibling search rows; changing the title source does",
  () =>
    Effect.gen(function* () {
      const database = yield* Database
      const sql = database.sql
      const accounts = database.repository(Account)
      const affiliations = database.repository(Affiliation)
      const contact = yield* database
        .repository(Contact)
        .create({ name: "Ada" })
      const account = yield* accounts.create({ name: "Quasar" })
      const first = yield* affiliations.create({
        links: { contact: contact.id, account: account.id },
      })
      const rows = sql<{
        id: string
        revision: string
      }>`select id, xmin::text as revision from ${recordSearch} order by id`
      const before = yield* rows
      const second = yield* affiliations.create({
        links: { contact: contact.id, account: account.id },
      })
      // Row versions catch redundant UPDATEs even when their rendered values did not change.
      expect((yield* rows).filter(({ id }) => id !== second.id)).toEqual(before)
      yield* accounts.update({ id: account.id, name: "Nebula" })
      expect(
        (yield* affiliations.list({ query: "Nebula" })).items
          .map(({ id }) => id)
          .sort()
      ).toEqual([first.id, second.id].sort())
      expect((yield* affiliations.list({ query: "Quasar" })).items).toEqual([])
      const elsewhere = yield* accounts.create({ name: "Elsewhere" })
      yield* affiliations.update({
        id: second.id,
        links: { account: elsewhere.id },
      })
      expect(
        (yield* affiliations.list({ query: "Nebula" })).items.map(
          ({ id }) => id
        )
      ).toEqual([first.id])
      expect(
        (yield* affiliations.list({ query: "Elsewhere" })).items.map(
          ({ id }) => id
        )
      ).toEqual([second.id])
    })
)
