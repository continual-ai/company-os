import { CommittedChanges } from "@company/runtime/server/database/committed-changes"
import { Database } from "@company/runtime/server/database/database"
import { CurrentInvocation } from "@company/runtime/server/invocation"
import {
  anonymousInvocation,
  systemInvocation,
} from "@company/runtime/server/invocation-context"
import { PageTokens } from "@company/runtime/server/page-tokens"
import { Effect, Layer } from "effect"
import { expect } from "vitest"

import {
  ModelImplementation,
  makeApplicationServicesLayer,
} from "#/examples/services.server.ts"
import { itDatabase } from "#/server/database/it-database.ts"
import { seedSystem } from "#/server/seeds/seed-system.ts"

itDatabase(
  "escalates once under concurrent retries and preserves authorization and atomic rollback",
  Effect.fn(function* () {
    const database = yield* Database
    yield* seedSystem().pipe(Effect.provide(PageTokens.layerTest))
    yield* Effect.gen(function* () {
      const { services } = yield* ModelImplementation
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
      ).toMatchObject({ _tag: "PermissionDenied" })

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
    }).pipe(
      Effect.provide(
        makeApplicationServicesLayer({
          database: Layer.succeed(Database, database),
          pageTokens: PageTokens.layerTest,
        })
      ),
      Effect.provideService(CurrentInvocation, systemInvocation)
    )
  })
)
