import { Effect } from "effect"
import { expect } from "vitest"

import { EngineeringModule } from "#/modules/engineering/model/index.ts"
import { NotesModule } from "#/modules/notes/model/index.ts"
import { SalesModule } from "#/modules/sales/model/index.ts"
import { SalesServer } from "#/modules/sales/server/index.ts"
import { SupportEngineeringModule } from "#/modules/support-engineering/model/index.ts"
import { SupportEngineeringServer } from "#/modules/support-engineering/server/index.ts"
import { SupportModule } from "#/modules/support/model/index.ts"
import { defineModel } from "#/runtime/model/index.ts"
import { PlatformModule } from "#/runtime/platform/model/index.ts"
import { anonymousInvocation } from "#/runtime/server/invocation-context.ts"
import { CurrentInvocation } from "#/runtime/server/invocation.ts"
import { modelImplementation } from "#/runtime/server/model/implementation.ts"
import { CommittedChanges } from "#/runtime/server/storage/committed-changes.ts"
import { Database } from "#/runtime/server/storage/database.ts"
import { testFoundation } from "#/runtime/testing/foundation.ts"

const model = defineModel({
  name: "Support engineering test",
  modules: [
    PlatformModule,
    NotesModule,
    SalesModule,
    SupportModule,
    EngineeringModule,
    SupportEngineeringModule,
  ],
})
const fixture = testFoundation(model, {
  servers: [SalesServer, SupportEngineeringServer],
})
const implementation = modelImplementation(model)

fixture.test(
  "escalates once under concurrent retries and preserves authorization and atomic rollback",
  () =>
    Effect.gen(function* () {
      const database = yield* Database
      const { services } = yield* implementation
      const ticket = yield* services.ticket.create({
        subject: "Export drops attachments",
        description: "Customer export is missing files.",
        priority: "high",
      })
      const changes = new Set<string>()
      const results = yield* Effect.all(
        [
          services.escalation.createIssue({ ticket: ticket.id }),
          services.escalation.createIssue({ ticket: ticket.id }),
        ],
        { concurrency: 2 }
      ).pipe(Effect.provideService(CommittedChanges, changes))
      expect(results[0]).toEqual(results[1])
      expect(changes).toEqual(new Set(["issue", "ticket", "escalation"]))
      expect((yield* services.issue.list({})).totalSize).toBe(1)
      expect((yield* services.escalation.list({})).totalSize).toBe(1)
      expect(yield* services.issue.get({ id: results[0].issue })).toMatchObject(
        {
          title: ticket.subject,
          description: ticket.description,
          priority: "high",
          status: "backlog",
        }
      )
      expect(
        yield* database.sql`select count(*)::int as count from event_journal where type = 'escalation.ticketEscalated'`
      ).toEqual([{ count: 1 }])
      changes.clear()
      expect(
        yield* services.escalation
          .createIssue({ ticket: ticket.id })
          .pipe(Effect.provideService(CommittedChanges, changes))
      ).toEqual(results[0])
      expect(changes.size).toBe(0)
      expect(
        yield* services.escalation
          .createIssue({ ticket: ticket.id })
          .pipe(
            Effect.provideService(CurrentInvocation, anonymousInvocation),
            Effect.flip
          )
      ).toMatchObject({ _tag: "ProjectAccessRequired" })

      const closed = yield* services.ticket.create({
        subject: "Already resolved",
        status: "closed",
      })
      expect(
        yield* services.escalation
          .createIssue({ ticket: closed.id })
          .pipe(Effect.flip)
      ).toMatchObject({ reason: "FAILED_PRECONDITION" })
      const rollback = yield* services.ticket.create({
        subject: "Canceled escalation",
      })
      changes.clear()
      yield* database
        .transaction(() =>
          services.escalation
            .createIssue({ ticket: rollback.id })
            .pipe(Effect.andThen(Effect.fail("cancel")))
        )
        .pipe(Effect.provideService(CommittedChanges, changes), Effect.flip)
      expect(changes.size).toBe(0)
      expect((yield* services.issue.list({})).totalSize).toBe(1)
      expect((yield* services.escalation.list({})).totalSize).toBe(1)
      expect(
        yield* database.sql`select count(*)::int as count from event_journal where type = 'escalation.ticketEscalated'`
      ).toEqual([{ count: 1 }])
      yield* services.escalation.createIssue({ ticket: rollback.id })
      expect((yield* services.issue.list({})).totalSize).toBe(2)
    })
)
