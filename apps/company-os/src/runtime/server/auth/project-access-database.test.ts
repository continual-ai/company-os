import { Effect } from "effect"
import { expect } from "vitest"

import { ServiceAccountService } from "#/runtime/access/server/service-account-service.ts"
import { UserService } from "#/runtime/access/server/user-service.ts"
import {
  EmailAddress,
  modelObjectLinkTraversals,
  RecordId,
} from "#/runtime/model/index.ts"
import { EventJournal } from "#/runtime/server/events/event-journal.ts"
import {
  authenticatedInvocation,
  anonymousInvocation,
} from "#/runtime/server/invocation-context.ts"
import { CurrentInvocation } from "#/runtime/server/invocation.ts"
import { ModelContext } from "#/runtime/server/model-context.ts"
import { modelImplementation } from "#/runtime/server/model/implementation.ts"
import { Links } from "#/runtime/server/model/link-service.ts"
import { createRecordSearch } from "#/runtime/server/record-search.ts"
import { Database } from "#/runtime/server/storage/database.ts"
import { assignments } from "#/runtime/server/storage/statement.ts"
import { fixtureModel, Account } from "#/runtime/testing/fixture-model.ts"
import { FixtureServer } from "#/runtime/testing/fixture-server.ts"
import { testFoundation } from "#/runtime/testing/foundation.ts"

const denied = <A, E, R>(operation: Effect.Effect<A, E, R>) =>
  operation.pipe(
    Effect.provideService(CurrentInvocation, anonymousInvocation),
    Effect.flip,
    Effect.tap((error) =>
      Effect.sync(() =>
        expect(error).toMatchObject({ _tag: "ProjectAccessRequired" })
      )
    )
  )

const fixture = testFoundation(fixtureModel, { servers: [FixtureServer] })
fixture.test(
  "users and service accounts share project records, links, search and events without grants",
  () =>
    Effect.gen(function* () {
      const { services } = yield* modelImplementation(fixtureModel)
      const user = yield* (yield* UserService).provision({
        name: "Member",
        email: EmailAddress("member@example.test"),
      })
      const agent = yield* (yield* ServiceAccountService).provision({
        name: "Agent",
      })
      const account = yield* services.account.create({
        name: "Shared access regression",
      })
      const journal = yield* EventJournal
      const links = yield* Links
      const traversal = modelObjectLinkTraversals(fixtureModel, Account).find(
        ({ traversal: direction }) => direction.key === "people"
      )!
      for (const identity of [user, agent]) {
        const invocation = yield* authenticatedInvocation(identity.id)
        yield* Effect.gen(function* () {
          expect(
            (yield* services.account.list({})).items.some(
              ({ id }) => id === account.id
            )
          ).toBe(true)
          const updated = yield* services.account.update({
            id: account.id,
            name: "Shared access regression",
          })
          expect(updated.updatedBy).toBe(identity.id)
          const person = yield* services.person.create({ name: identity.name })
          yield* links.link(traversal, { id: account.id, target: person.id })
          expect(
            (yield* links.list(traversal, { id: account.id })).items.some(
              ({ id }) => id === person.id
            )
          ).toBe(true)
          expect(
            (yield* createRecordSearch(fixtureModel)({
              query: "Shared access",
            })).hits.some(({ id }) => id === account.id)
          ).toBe(true)
          expect(
            (yield* journal.list({ pageSize: 500 })).items.some(
              (event) => event.actorId === identity.id
            )
          ).toBe(true)
        }).pipe(Effect.provideService(CurrentInvocation, invocation))
      }
      yield* denied(services.account.list({}))
      yield* denied(services.account.get({ id: account.id }))
      yield* denied(services.account.create({ name: "Denied" }))
      yield* denied(services.account.update({ id: account.id, name: "Denied" }))
      yield* denied(services.account.delete({ id: account.id }))
      yield* denied(services.account.batchGet({ ids: [] }))
      yield* denied(services.account.batchDelete({ ids: [] }))
      yield* denied(links.initialize(Account, account.id, {}))
      yield* denied(links.update(Account, account.id, {}))
      yield* denied(
        links.link(traversal, {
          id: account.id,
          target: RecordId("person")("missing"),
        })
      )
      yield* denied(
        links.unlink(traversal, {
          id: account.id,
          target: RecordId("person")("missing"),
        })
      )
      yield* denied(links.list(traversal, { id: account.id }))
      yield* denied(createRecordSearch(fixtureModel)({ query: "Shared" }))
      yield* denied(journal.list())
    })
)

fixture.test(
  "project admission does not permit changing immutable system records",
  () =>
    Effect.gen(function* () {
      const { services } = yield* modelImplementation(fixtureModel)
      const member = yield* (yield* UserService).provision({
        name: "Member",
        email: EmailAddress("immutable@example.test"),
      })
      const record = yield* services.account.create({ name: "System record" })
      const { sql } = yield* Database
      const { storage } = yield* ModelContext
      const objects = storage.core.objects
      yield* sql`update ${objects} set ${assignments(sql, objects, { systemManaged: true })} where ${objects.columns.id} = ${record.id}`
      const invocation = yield* authenticatedInvocation(member.id)
      const operations: ReadonlyArray<
        Effect.Effect<unknown, unknown, CurrentInvocation>
      > = [
        services.account
          .update({ id: record.id, name: "Changed" })
          .pipe(Effect.asVoid),
        services.account.delete({ id: record.id }).pipe(Effect.asVoid),
        services.account.batchDelete({ ids: [record.id] }).pipe(Effect.asVoid),
      ]
      for (const operation of operations) {
        expect(
          yield* operation.pipe(
            Effect.provideService(CurrentInvocation, invocation),
            Effect.flip
          )
        ).toMatchObject({ _tag: "SystemRecordReadOnly" })
      }
      expect((yield* services.account.get({ id: record.id })).name).toBe(
        "System record"
      )
    })
)

fixture.test(
  "Link changes and their events roll back if a later target is missing",
  () =>
    Effect.gen(function* () {
      const { services } = yield* modelImplementation(fixtureModel)
      const links = yield* Links
      const journal = yield* EventJournal
      const account = yield* services.account.create({ name: "Atomic links" })
      const person = yield* services.person.create({ name: "Valid target" })
      const traversal = modelObjectLinkTraversals(fixtureModel, Account).find(
        ({ traversal: direction }) => direction.key === "people"
      )!
      const before = yield* journal.list({ cursor: "now" })
      const operations: ReadonlyArray<
        Effect.Effect<unknown, unknown, CurrentInvocation>
      > = [
        links.initialize(Account, account.id, {
          people: [person.id, RecordId("person")("missing")],
        }),
        links.update(Account, account.id, {
          people: { add: [person.id, RecordId("person")("missing")] },
        }),
        links.writer(Account).initialize(account.id, {
          people: [person.id, RecordId("person")("missing")],
        }),
        links.writer(Account).update(account.id, {
          people: { add: [person.id, RecordId("person")("missing")] },
        }),
      ]
      for (const operation of operations) {
        expect(yield* operation.pipe(Effect.flip)).toMatchObject({
          _tag: "ObjectNotFound",
          recordId: "missing",
        })
        expect(
          (yield* links.list(traversal, { id: account.id })).items
        ).toEqual([])
        expect(
          (yield* journal.list({ cursor: before.nextCursor })).items
        ).toEqual([])
      }
      const wrongType: ReadonlyArray<
        Effect.Effect<unknown, unknown, CurrentInvocation>
      > = [
        links.link(traversal, { id: account.id, target: account.id }),
        links.unlink(traversal, { id: account.id, target: account.id }),
        links.list(traversal, { id: person.id }),
      ]
      for (const operation of wrongType)
        expect(yield* operation.pipe(Effect.flip)).toMatchObject({
          _tag: "ObjectNotFound",
        })
      expect(
        yield* services.account
          .batchDelete({ ids: [account.id, RecordId("account")("missing")] })
          .pipe(Effect.flip)
      ).toMatchObject({ _tag: "ObjectNotFound" })
      expect((yield* services.account.get({ id: account.id })).name).toBe(
        "Atomic links"
      )
    })
)
