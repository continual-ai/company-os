import { Effect } from "effect"
import { expect } from "vitest"

import { EmailAddress } from "#/runtime/model/index.ts"
import { Database } from "#/runtime/server/database.ts"
import { makeEventWriter } from "#/runtime/server/events/event-writer.ts"
import { ModelContext } from "#/runtime/server/model-context.ts"
import { operationsFor } from "#/runtime/server/operation-executor.ts"
import { createRecordSearch } from "#/runtime/server/record-search.ts"
import { assignments } from "#/runtime/server/storage/index.ts"
import { recordSearch } from "#/runtime/server/storage/infrastructure.ts"
import { ensureSearchIndex } from "#/runtime/server/storage/search-index.ts"
import { SqlDatabase } from "#/runtime/server/storage/transactions.ts"
import { Account, fixtureModel } from "#/runtime/testing/fixture-model.ts"
import { FixtureServer } from "#/runtime/testing/fixture-server.ts"
import { testFoundation } from "#/runtime/testing/foundation.ts"

const fixture = testFoundation(fixtureModel, { servers: [FixtureServer] })
const implementation = operationsFor(fixtureModel)
const accounts = fixture.storage.objects.account
const searchRecords = createRecordSearch(fixtureModel)

fixture.test(
  "searches indexed fields across types, ranks titles, and follows transactions with transactional index maintenance",
  () =>
    Effect.gen(function* () {
      const database = yield* SqlDatabase
      const sql = database.sql
      const services = yield* implementation
      const account = yield* services.account.create({
        name: "Quasar laboratories",
      })
      const person = yield* services.person.create({
        name: "Ada Lovelace",
        email: EmailAddress("ada@quasar.test"),
      })
      const prospect = yield* services.prospect.create({
        name: "Onboarding",
        accountName: "Quasar laboratories connection",
      })
      const found = yield* searchRecords({ query: "quas" })
      expect(found.items.map((hit) => hit.id)).toEqual(
        expect.arrayContaining([account.id, person.id, prospect.id])
      )
      expect(found.items[0]?.id).toBe(account.id)
      expect(found.totalSize).toBe(3)
      expect(
        (yield* searchRecords({ query: "quas", objectTypes: ["prospect"] }))
          .totalSize
      ).toBe(1)
      expect(
        (yield* searchRecords({ query: "QUAS LAB" })).items.map((hit) => hit.id)
      ).toEqual([account.id, prospect.id])
      expect(
        (yield* searchRecords({ query: "ada@quasar.test" })).items.map(
          (hit) => hit.id
        )
      ).toEqual([person.id])
      expect(
        (yield* searchRecords({
          query: "quas",
          objectTypes: ["prospect"],
        })).items.map((hit) => hit.id)
      ).toEqual([prospect.id])
      expect(
        (yield* searchRecords({ query: "quas", pageSize: 1 })).nextPageToken
      ).not.toBeNull()
      expect(
        (yield* searchRecords({ query: "quas", objectTypes: [] })).items
      ).toEqual([])
      for (const query of ["", "  ", "' & | :* ()", "quasar nonexistentword"])
        expect((yield* searchRecords({ query })).items).toEqual([])

      yield* database
        .transaction(() =>
          Effect.gen(function* () {
            // Custom SQL declares its affected records through the same transactional fact boundary.
            yield* sql`update ${accounts} set ${assignments(sql, accounts, { name: "Renamed foundation" })}
          where ${accounts.columns.id} = ${account.id}`
            const events = makeEventWriter(database, yield* ModelContext)
            yield* events.record({
              type: "account.updated",
              version: 1,
              subjects: yield* events.subjects([account.id]),
              data: yield* (yield* Database)
                .repository(Account)
                .get({ id: account.id }),
            })
            return yield* Effect.fail("rollback")
          })
        )
        .pipe(Effect.catch(() => Effect.void))
      expect((yield* searchRecords({ query: "renamed" })).items).toEqual([])
      expect(
        (yield* searchRecords({ query: "quasar", objectTypes: ["account"] }))
          .items[0]?.id
      ).toBe(account.id)
      yield* services.account.update({
        id: account.id,
        name: "Renamed foundation",
      })
      expect(
        (yield* searchRecords({ query: "quasar", objectTypes: ["account"] }))
          .items
      ).toEqual([])
      yield* services.account.delete({ id: account.id })
      expect((yield* searchRecords({ query: "renamed" })).items).toEqual([])

      yield* sql`delete
          from ${recordSearch}`
      expect((yield* searchRecords({ query: "quas" })).items).toEqual([])
      yield* ensureSearchIndex(database, yield* ModelContext, true)
      expect(
        (yield* searchRecords({ query: "quas" })).items.map((hit) => hit.id)
      ).toEqual(expect.arrayContaining([person.id, prospect.id]))
      const plan = yield* database.transaction(() =>
        Effect.gen(function* () {
          yield* sql`set local enable_seqscan = off`
          return yield* sql`explain (format json) select id
          from ${recordSearch}
          where ${recordSearch.columns.document} @@ to_tsquery('simple', 'quas:*')`
        })
      )
      expect(JSON.stringify(plan)).toContain("record_search_document_idx")
    })
)
