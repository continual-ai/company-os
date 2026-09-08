import { assignments } from "@company/postgres"
import { tableProjection, type TableRow } from "@company/postgres"
import { EmailAddress, modelObjectLinkTraversals } from "@company/runtime"
import { CurrentInvocation } from "@company/runtime/effect/object-service"
import { Deferred, Effect, Fiber, Layer } from "effect"
import { expect } from "vitest"

import { Model } from "#/app.model.ts"
import { InvalidEventCursor } from "#/events.ts"
import { UserService } from "#/modules/access/user/server/user-service.ts"
import { LeadConverted } from "#/modules/sales/lead/model.ts"
import { makeApplicationLayer } from "#/server/application-layer.ts"
import { CommittedChanges } from "#/server/database/committed-changes.ts"
import { Database } from "#/server/database/database.ts"
import { itDatabase } from "#/server/database/it-database.ts"
import { makeObjectRepository } from "#/server/database/object-repository.ts"
import { eventJournal, eventJournalState } from "#/server/database/schema.ts"
import { EventJournal } from "#/server/events/event-journal.ts"
import { flushEvents } from "#/server/events/flush-events.ts"
import { systemInvocation } from "#/server/invocation-context.ts"
import { Links } from "#/server/model/link-service.ts"
import { ModelImplementation } from "#/server/model/model-implementation.ts"
import { makeObjectWriter } from "#/server/model/object-service.ts"
import { RecordIdentifierResolver } from "#/server/model/record-identifier-resolver.ts"
import { PageTokens } from "#/server/page-tokens.ts"
import { seedSystem } from "#/server/seeds/seed-system.ts"
import { ROOT_ID } from "#/system-records.ts"

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
          RecordIdentifierResolver.layer,
          PageTokens.layerTest
        )
      ),
      Effect.provideService(CurrentInvocation, systemInvocation)
    )
  })
}

itDatabase(
  "records business writes, semantic events, savepoints, and Link cascades atomically",
  () =>
    application(
      Effect.gen(function* () {
        const database = yield* Database
        const journal = yield* EventJournal
        const { services } = yield* ModelImplementation
        const start = yield* journal.list({ cursor: "now" })
        const changes = new Set<string>()
        yield* database
          .transaction(() =>
            services.company
              .create({ name: "Rolled back" })
              .pipe(Effect.andThen(Effect.fail("rollback")))
          )
          .pipe(
            Effect.provideService(CommittedChanges, changes),
            Effect.catch(() => Effect.void)
          )
        expect([...changes]).toEqual([])
        expect(
          (yield* journal.list({ cursor: start.nextCursor })).items
        ).toEqual([])

        yield* database
          .transaction(() =>
            Effect.gen(function* () {
              yield* services.company.create({ name: "Kept" })
              expect([...changes]).toEqual([])
              yield* database.transaction((tx) =>
                tx
                  .transaction(() =>
                    services.company
                      .create({ name: "Nested transaction handle rollback" })
                      .pipe(Effect.andThen(Effect.fail("rollback")))
                  )
                  .pipe(Effect.catch(() => Effect.void))
              )

              yield* database
                .transaction(() =>
                  services.contact
                    .create({ name: "Savepoint rollback" })
                    .pipe(Effect.andThen(Effect.fail("rollback")))
                )
                .pipe(Effect.catch(() => Effect.void))
            })
          )
          .pipe(Effect.provideService(CommittedChanges, changes))
        expect([...changes]).toEqual(["company"])
        expect(
          (yield* services.company.list({})).items.map((item) => item.name)
        ).toEqual(["Kept"])
        expect(
          (yield* journal.list({ cursor: start.nextCursor })).items.map(
            (item) => item.type
          )
        ).toEqual(["company.created"])

        const lead = yield* services.lead.create({
          name: "Ada",
          companyName: "Engine",
        })
        const before = yield* journal.list({ cursor: "now" })
        const converted = yield* services.lead.convert({ id: lead.id })
        yield* services.lead.convert({ id: lead.id })
        const page = yield* journal.list({ cursor: before.nextCursor })
        expect(
          page.items.filter((event) => event.type === "lead.converted")
        ).toMatchObject([
          { data: converted, actorId: systemInvocation.actorId },
        ])
        expect(
          new Set(page.items.map((event) => event.transactionId)).size
        ).toBe(1)
        expect(page.items.map((event) => event.type)).toEqual(
          expect.arrayContaining([
            "company.created",
            "contact.created",
            "lead.updated",
            "contactCompanies.linked",
            "contactPrimaryCompany.linked",
            "lead.converted",
          ])
        )
        expect(
          (yield* journal.list({ cursor: page.nextCursor })).items
        ).toEqual([])

        const standalone = yield* services.company.create({
          name: "Disposable",
        })
        const person = yield* services.contact.create({ name: "Member" })
        const links = yield* Links
        const primary = modelObjectLinkTraversals(
          Model,
          Model.objects.contact
        ).find(({ traversal }) => traversal.key === "primaryCompany")!
        yield* links.link(primary, { id: person.id, target: standalone.id })
        const checkpoint = yield* journal.list({ cursor: "now" })
        const membership = modelObjectLinkTraversals(
          Model,
          Model.objects.company
        ).find(({ traversal }) => traversal.key === "contacts")!
        yield* links.link(membership, { id: standalone.id, target: person.id })
        expect(
          (yield* journal.list({ cursor: checkpoint.nextCursor })).items
        ).toEqual([])
        yield* services.company.delete({ id: standalone.id })
        expect(
          (yield* journal.list({ cursor: checkpoint.nextCursor })).items
            .map((event) => event.type)
            .sort()
        ).toEqual([
          "company.deleted",
          "contactCompanies.unlinked",
          "contactPrimaryCompany.unlinked",
        ])
      })
    )
)

itDatabase(
  "never skips a transaction that began earlier but commits later",
  () =>
    application(
      Effect.gen(function* () {
        const database = yield* Database
        const sql = database.sql
        const journal = yield* EventJournal
        const { services } = yield* ModelImplementation
        const start = yield* journal.list({ cursor: "now" })
        const staged = yield* Deferred.make<void>()
        const release = yield* Deferred.make<void>()
        const slow = yield* Effect.forkChild(
          database.transaction(() =>
            Effect.gen(function* () {
              const record = yield* services.company.create({
                name: "Commits second",
              })
              yield* Deferred.succeed(staged, undefined)
              yield* Deferred.await(release)
              return record
            })
          )
        )
        yield* Deferred.await(staged)
        const fast = yield* services.company.create({ name: "Commits first" })
        const firstPage = yield* journal.list({ cursor: start.nextCursor })
        expect(firstPage.items.map((event) => event.subjects[0]?.id)).toEqual([
          fast.id,
        ])
        yield* Deferred.succeed(release, undefined)
        const late = yield* Fiber.join(slow)
        expect(
          (yield* journal.list({ cursor: firstPage.nextCursor })).items.map(
            (event) => event.subjects[0]?.id
          )
        ).toEqual([late.id])
        const rows = yield* sql<
          TableRow<typeof eventJournal>
        >`select ${tableProjection(eventJournal)}
          from ${eventJournal}
          order by ${sql.csv([eventJournal.columns.position])}`
        const [state] = yield* sql<
          TableRow<typeof eventJournalState>
        >`select ${tableProjection(eventJournalState)}
          from ${eventJournalState}`
        expect(rows.at(-1)?.position).toBe(state?.position)
      })
    )
)

itDatabase(
  "filters every subject, preserves deleted history, and signals permission changes without exposing hidden events",
  () =>
    application(
      Effect.gen(function* () {
        const database = yield* Database
        const sql = database.sql
        const journal = yield* EventJournal
        const { services } = yield* ModelImplementation
        const user = yield* (yield* UserService).provision({
          name: "Reader",
          email: EmailAddress("events@example.test"),
        })
        const reader = { actorId: user.id, authorizationActorId: user.id }
        const roles = yield* makeObjectWriter(
          Model.objects.role,
          yield* makeObjectRepository(Model.objects.role)
        )
        const role = yield* roles.create({
          name: "Company history",
          scopeType: "company",
          permissions: ["company.get"],
        })
        const visible = yield* services.company.create({ name: "Visible" })
        const hidden = yield* services.company.create({ name: "Hidden" })
        const assignment = yield* services.roleAssignment.create({
          parent: visible.id,
          role: role.id,
          principal: user.id,
        })
        const read = (input: Parameters<typeof journal.list>[0] = {}) =>
          journal
            .list(input)
            .pipe(Effect.provideService(CurrentInvocation, reader))
        const before = yield* read({ cursor: "now" })
        yield* services.company.update({ id: hidden.id, name: "Still hidden" })
        yield* services.company.update({
          id: visible.id,
          name: "Still visible",
        })
        const first = yield* read({ cursor: before.nextCursor, pageSize: 1 })
        expect(first.items).toEqual([])
        expect(first.hasMore).toBe(true)
        const second = yield* read({ cursor: first.nextCursor, pageSize: 1 })
        expect(second.items.map((event) => event.subjects[0]?.id)).toEqual([
          visible.id,
        ])
        const contact = yield* services.contact.create({
          name: "Hidden contact",
        })
        const membership = modelObjectLinkTraversals(
          Model,
          Model.objects.company
        ).find(({ traversal }) => traversal.key === "contacts")!
        yield* (yield* Links).link(membership, {
          id: visible.id,
          target: contact.id,
        })
        expect((yield* read({ cursor: second.nextCursor })).items).toEqual([])
        expect(contact.id).toBeDefined()
        yield* services.roleAssignment.delete({ id: assignment.id })
        const revoked = yield* read({ cursor: second.nextCursor })
        expect(revoked.reset).toBe(true)
        expect(revoked.items).toEqual([])
        expect(
          yield* read({
            cursor: (yield* journal.list({ cursor: "now" })).nextCursor,
          }).pipe(Effect.flip)
        ).toBeInstanceOf(InvalidEventCursor)
        expect(
          yield* read({ cursor: "tampered" }).pipe(Effect.flip)
        ).toBeInstanceOf(InvalidEventCursor)

        // Grant at the root survives subject deletion; direct grants on a deleted object do not.
        const historyRole = yield* roles.create({
          name: "Company reader",
          scopeType: "root",
          permissions: ["company.get"],
        })
        yield* services.roleAssignment.create({
          parent: ROOT_ID,
          role: historyRole.id,
          principal: user.id,
        })
        const deleting = yield* read({ cursor: "now" })
        const disposable = yield* services.company.create({ name: "History" })
        yield* services.company.delete({ id: disposable.id })
        expect(
          (yield* read({
            cursor: deleting.nextCursor,
            type: undefined,
          })).items.map((event) => event.type)
        ).toEqual(["company.created", "company.deleted"])
        expect(
          (yield* sql<
            TableRow<typeof eventJournal>
          >`select ${tableProjection(eventJournal)}
          from ${eventJournal}
          where ${eventJournal.columns.type} = ${"company.deleted"}`).length
        ).toBe(1)
      })
    )
)

itDatabase(
  "rejects append outside a transaction instead of producing a non-atomic event",
  () =>
    application(
      Effect.gen(function* () {
        const journal = yield* EventJournal
        const { services } = yield* ModelImplementation
        const lead = yield* services.lead.create({
          name: "Ada",
          companyName: "Engine",
        })
        const converted = yield* services.lead.convert({ id: lead.id })
        const before = yield* journal.list({ cursor: "now" })
        const result = yield* journal
          .append(LeadConverted, {
            subject: lead.id,
            data: converted,
          })
          .pipe(Effect.exit)
        expect(result._tag).toBe("Failure")
        expect(
          (yield* journal.list({ cursor: before.nextCursor })).items
        ).toEqual([])
      })
    )
)

itDatabase(
  "rolls back business writes when journal persistence fails and forbids rewriting history",
  () =>
    application(
      Effect.gen(function* () {
        const database = yield* Database
        const sql = database.sql
        const journal = yield* EventJournal
        const { services } = yield* ModelImplementation
        yield* services.company.create({ name: "Committed" })
        const before = yield* journal.list({ cursor: "now" })
        // Force a journal primary-key collision at flush, after the business INSERT succeeds.
        const changes = new Set<string>()
        const failed = yield* database
          .transaction(() =>
            Effect.gen(function* () {
              yield* sql`update ${eventJournalState} set ${assignments(sql, eventJournalState, { position: 0n })}
          where ${eventJournalState.columns.id} = ${1}`
              yield* services.company.create({ name: "Must roll back" })
            })
          )
          .pipe(Effect.provideService(CommittedChanges, changes), Effect.exit)
        expect([...changes]).toEqual([])
        expect(failed._tag).toBe("Failure")
        expect(
          (yield* services.company.list({})).items.map((item) => item.name)
        ).toEqual(["Committed"])
        expect(
          (yield* journal.list({ cursor: before.nextCursor })).items
        ).toEqual([])
        expect(
          (yield* sql`update ${eventJournal} set ${assignments(sql, eventJournal, { actorId: "forged" })}`.pipe(
            Effect.exit
          ))._tag
        ).toBe("Failure")
        expect(
          (yield* sql`delete
          from ${eventJournal}`.pipe(Effect.exit))._tag
        ).toBe("Failure")
      })
    )
)

itDatabase(
  "replays stored JSON after its original model shape has changed",
  () =>
    application(
      Effect.gen(function* () {
        const database = yield* Database
        const sql = database.sql
        const journal = yield* EventJournal
        const { services } = yield* ModelImplementation
        const start = yield* journal.list({ cursor: "now" })
        const contact = yield* services.contact.create({
          name: "Historical contact",
        })
        const original = (yield* journal.list({ cursor: start.nextCursor }))
          .items[0]!
        const historical = {
          id: contact.id,
          etag: contact.etag,
          oldName: "Preserved history",
        }
        const [stored] = yield* sql<
          TableRow<typeof eventJournal>
        >`select ${tableProjection(eventJournal)}
          from ${eventJournal}
          where ${eventJournal.columns.id} = ${original.id}`
        if (stored === undefined) throw new Error("Missing committed event")
        // Seed an old format below today's writer decoder without rewriting history.
        yield* database.transaction((tx) =>
          flushEvents(tx, [
            { ...stored, id: "ev_historical", data: historical },
          ])
        )
        const replay = yield* journal.list({ cursor: start.nextCursor })
        expect(
          replay.items.find((event) => event.id === "ev_historical")?.data
        ).toEqual(historical)
        expect((yield* services.contact.get({ id: contact.id })).name).toBe(
          "Historical contact"
        )
      })
    )
)
