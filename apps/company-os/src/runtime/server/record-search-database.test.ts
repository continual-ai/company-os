import { Effect } from "effect"
import { expect } from "vitest"

import { Role } from "#/runtime/access/model/index.ts"
import { UserService } from "#/runtime/access/server/user-service.ts"
import { EmailAddress } from "#/runtime/model/index.ts"
import { makeEventWriter } from "#/runtime/server/events/event-writer.ts"
import { CurrentInvocation } from "#/runtime/server/invocation.ts"
import { ModelContext } from "#/runtime/server/model-context.ts"
import { modelImplementation } from "#/runtime/server/model/implementation.ts"
import { ObjectRepositories } from "#/runtime/server/model/object-repositories.ts"
import { createRecordSearch } from "#/runtime/server/record-search.ts"
import { Database } from "#/runtime/server/storage/database.ts"
import { assignments } from "#/runtime/server/storage/index.ts"
import { recordSearch } from "#/runtime/server/storage/infrastructure.ts"
import { ensureSearchIndex } from "#/runtime/server/storage/search-index.ts"
import { fixtureModel } from "#/runtime/testing/fixture-model.ts"
import { FixtureServer } from "#/runtime/testing/fixture-server.ts"
import { testFoundation } from "#/runtime/testing/foundation.ts"

const fixture = testFoundation(fixtureModel, { servers: [FixtureServer] })
const implementation = modelImplementation(fixtureModel)
const accounts = fixture.storage.objects.account
const searchRecords = createRecordSearch(fixtureModel)

fixture.test(
  "searches indexed fields across types, ranks titles, and follows transactions with transactional index maintenance",
  () =>
    Effect.gen(function* () {
      const database = yield* Database
      const sql = database.sql
      const { services } = yield* implementation
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
      expect(found.hits.map((hit) => hit.id)).toEqual(
        expect.arrayContaining([account.id, person.id, prospect.id])
      )
      expect(found.hits[0]?.id).toBe(account.id)
      expect(
        (yield* searchRecords({ query: "QUAS LAB" })).hits.map((hit) => hit.id)
      ).toEqual([account.id, prospect.id])
      expect(
        (yield* searchRecords({ query: "ada@quasar.test" })).hits.map(
          (hit) => hit.id
        )
      ).toEqual([person.id])
      expect(
        (yield* searchRecords({
          query: "quas",
          objectTypes: ["prospect"],
        })).hits.map((hit) => hit.id)
      ).toEqual([prospect.id])
      expect((yield* searchRecords({ query: "quas", limit: 1 })).hasMore).toBe(
        true
      )
      expect(
        (yield* searchRecords({ query: "quas", objectTypes: [] })).hits
      ).toEqual([])
      for (const query of ["", "  ", "' & | :* ()", "quasar nonexistentword"])
        expect((yield* searchRecords({ query })).hits).toEqual([])

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
              data: yield* services.account.get({ id: account.id }),
            })
            return yield* Effect.fail("rollback")
          })
        )
        .pipe(Effect.catch(() => Effect.void))
      expect((yield* searchRecords({ query: "renamed" })).hits).toEqual([])
      expect(
        (yield* searchRecords({ query: "quasar", objectTypes: ["account"] }))
          .hits[0]?.id
      ).toBe(account.id)
      yield* services.account.update({
        id: account.id,
        name: "Renamed foundation",
      })
      expect(
        (yield* searchRecords({ query: "quasar", objectTypes: ["account"] }))
          .hits
      ).toEqual([])
      yield* services.account.delete({ id: account.id })
      expect((yield* searchRecords({ query: "renamed" })).hits).toEqual([])

      yield* sql`delete
          from ${recordSearch}`
      expect((yield* searchRecords({ query: "quas" })).hits).toEqual([])
      yield* ensureSearchIndex(database, yield* ModelContext, true)
      expect(
        (yield* searchRecords({ query: "quas" })).hits.map((hit) => hit.id)
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

fixture.test(
  "filters search before top-k and hasMore, and reflects grant revocation immediately",
  () =>
    Effect.gen(function* () {
      const { services } = yield* implementation
      const user = yield* (yield* UserService).provision({
        name: "Search reader",
        email: EmailAddress("search-reader@example.test"),
      })
      const roles = (yield* ObjectRepositories).writer(Role)
      const role = yield* roles.create({
        name: "Read one account",
        scopeType: "account",
        permissions: ["account.get"],
      })
      const hidden = yield* services.account.create({ name: "Needle" })
      const visible = yield* services.account.create({
        name: "Needle visible account",
      })
      yield* services.person.create({ name: "Needle private person" })
      const reader = { actorId: user.id, authorizationActorId: user.id }
      const read = () =>
        searchRecords({ query: "needle", limit: 1 }).pipe(
          Effect.provideService(CurrentInvocation, reader)
        )
      expect(yield* read()).toEqual({ hits: [], hasMore: false })
      const grant = yield* services.roleAssignment.create({
        parent: visible.id,
        role: role.id,
        principal: user.id,
      })
      const result = yield* read()
      expect(result.hits.map((hit) => hit.id)).toEqual([visible.id])
      expect(result.hasMore).toBe(false)
      expect(JSON.stringify(result)).not.toContain(hidden.id)
      yield* services.roleAssignment.delete({ id: grant.id })
      expect(yield* read()).toEqual({ hits: [], hasMore: false })
    })
)
