import { EmailAddress } from "@company/runtime"
import { CurrentInvocation } from "@company/runtime/effect/object-service"
import { Model } from "company-os/model"
import { eq, sql } from "drizzle-orm"
import { Effect, Layer } from "effect"
import { expect } from "vitest"

import { UserService } from "@/modules/access/user/server/user-service"
import { makeApplicationLayer } from "@/server/application-layer"
import { Database } from "@/server/database/database"
import { itDatabase } from "@/server/database/it-database"
import { makeObjectRepository } from "@/server/database/object-repository"
import { companies, recordSearch } from "@/server/database/schema"
import { ensureSearchIndex } from "@/server/database/search-index"
import { makeEventWriter } from "@/server/events/event-writer"
import { systemInvocation } from "@/server/invocation-context"
import { PageTokens } from "@/server/page-tokens"
import { seedSystem } from "@/server/seeds/seed-system"

import { ModelImplementation } from "./model-implementation"
import { makeObjectWriter } from "./object-service"
import { RecordIdentifierResolver } from "./record-identifier-resolver"
import { searchRecords } from "./search-records"

function application<A, E, R>(program: Effect.Effect<A, E, R>) {
  return Effect.gen(function* () {
    const database = yield* Database
    yield* seedSystem().pipe(Effect.provide(PageTokens.layerTest))
    return yield* program.pipe(
      Effect.provide(
        Layer.mergeAll(
          makeApplicationLayer({
            database: Layer.succeed(Database, database),
            pageTokens: PageTokens.layerTest,
          }),
          PageTokens.layerTest,
          RecordIdentifierResolver.layer
        )
      ),
      Effect.provideService(CurrentInvocation, systemInvocation)
    )
  })
}

itDatabase(
  "searches indexed fields across types, ranks titles, and follows transactions with transactional index maintenance",
  () =>
    application(
      Effect.gen(function* () {
        const database = yield* Database
        const { services } = yield* ModelImplementation
        const company = yield* services.company.create({
          name: "Quasar laboratories",
        })
        const contact = yield* services.contact.create({
          name: "Ada Lovelace",
          email: EmailAddress("ada@quasar.test"),
        })
        const issue = yield* services.issue.create({
          title: "Onboarding",
          description: "Quasar laboratories connection",
        })
        const found = yield* searchRecords({ query: "quas" })
        expect(found.hits.map((hit) => hit.id)).toEqual(
          expect.arrayContaining([company.id, contact.id, issue.id])
        )
        expect(found.hits[0]?.id).toBe(company.id)
        expect(
          (yield* searchRecords({ query: "QUAS LAB" })).hits.map(
            (hit) => hit.id
          )
        ).toEqual([company.id, issue.id])
        expect(
          (yield* searchRecords({ query: "ada@quasar.test" })).hits.map(
            (hit) => hit.id
          )
        ).toEqual([contact.id])
        expect(
          (yield* searchRecords({
            query: "quas",
            objectTypes: ["issue"],
          })).hits.map((hit) => hit.id)
        ).toEqual([issue.id])
        expect(
          (yield* searchRecords({ query: "quas", limit: 1 })).hasMore
        ).toBe(true)
        expect(
          (yield* searchRecords({ query: "quas", objectTypes: [] })).hits
        ).toEqual([])
        for (const query of ["", "  ", "' & | :* ()", "quasar nonexistentword"])
          expect((yield* searchRecords({ query })).hits).toEqual([])

        yield* database
          .transaction(() =>
            Effect.gen(function* () {
              // Custom SQL declares its affected records through the same transactional fact boundary.
              yield* database
                .update(companies)
                .set({ name: "Renamed foundation" })
                .where(eq(companies.id, company.id))
              const events = makeEventWriter(database)
              yield* events.record({
                type: "company.updated",
                version: 1,
                subjects: yield* events.subjects([company.id]),
                data: yield* services.company.get({ id: company.id }),
              })
              return yield* Effect.fail("rollback")
            })
          )
          .pipe(Effect.catch(() => Effect.void))
        expect((yield* searchRecords({ query: "renamed" })).hits).toEqual([])
        expect(
          (yield* searchRecords({ query: "quasar", objectTypes: ["company"] }))
            .hits[0]?.id
        ).toBe(company.id)
        yield* services.company.update({
          id: company.id,
          name: "Renamed foundation",
        })
        expect(
          (yield* searchRecords({ query: "quasar", objectTypes: ["company"] }))
            .hits
        ).toEqual([])
        yield* services.company.delete({ id: company.id })
        expect((yield* searchRecords({ query: "renamed" })).hits).toEqual([])

        yield* database.delete(recordSearch)
        expect((yield* searchRecords({ query: "quas" })).hits).toEqual([])
        yield* ensureSearchIndex(database, true)
        expect(
          (yield* searchRecords({ query: "quas" })).hits.map((hit) => hit.id)
        ).toEqual(expect.arrayContaining([contact.id, issue.id]))
        const plan = yield* database.transaction(() =>
          Effect.gen(function* () {
            yield* database.execute(sql`set local enable_seqscan = off`)
            return yield* database.execute(
              sql`explain (format json) select id from ${recordSearch} where ${recordSearch.document} @@ to_tsquery('simple', 'quas:*')`
            )
          })
        )
        expect(JSON.stringify(plan)).toContain("record_search_document_idx")
      })
    )
)

itDatabase(
  "filters search before top-k and hasMore, and reflects grant revocation immediately",
  () =>
    application(
      Effect.gen(function* () {
        const { services } = yield* ModelImplementation
        const user = yield* (yield* UserService).provision({
          name: "Search reader",
          email: EmailAddress("search-reader@example.test"),
        })
        const roles = yield* makeObjectWriter(
          Model.objects.role,
          yield* makeObjectRepository(Model.objects.role)
        )
        const role = yield* roles.create({
          name: "Read one company",
          scopeType: "company",
          permissions: ["company.get"],
        })
        const hidden = yield* services.company.create({ name: "Needle" })
        const visible = yield* services.company.create({
          name: "Needle visible company",
        })
        yield* services.contact.create({ name: "Needle private contact" })
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
)
