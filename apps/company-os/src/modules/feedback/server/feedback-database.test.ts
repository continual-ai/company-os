import { Effect } from "effect"
import { expect } from "vitest"

import { CrmModule, Contact } from "#/modules/crm/model/index.ts"
import { CrmServer } from "#/modules/crm/server/index.ts"
import { Feedback, FeedbackModule } from "#/modules/feedback/model/index.ts"
import { ServiceModule, Ticket } from "#/modules/service/model/index.ts"
import { WorkModule, Task } from "#/modules/work/model/index.ts"
import { ServiceAccount } from "#/runtime/access/model/index.ts"
import { defineModel } from "#/runtime/model/index.ts"
import { PlatformModule } from "#/runtime/platform/model/index.ts"
import { Database } from "#/runtime/server/index.ts"
import { testFoundation } from "#/runtime/testing/foundation.ts"

const fixture = testFoundation(
  defineModel({
    name: "Feedback test",
    modules: [
      PlatformModule,
      CrmModule,
      ServiceModule,
      WorkModule,
      FeedbackModule,
    ],
  }),
  { servers: [CrmServer] }
)

fixture.test(
  "preserves feedback independently of linked work and source tickets",
  () =>
    Effect.gen(function* () {
      const db = yield* Database
      const feedback = db.repository(Feedback)
      const tasks = db.repository(Task)
      const tickets = db.repository(Ticket)
      const reporter = yield* db
        .repository(Contact)
        .create({ name: "Maintenance lead" })
      const owner = yield* db
        .repository(ServiceAccount)
        .create({ name: "Feedback reviewer" })
      const source = yield* tickets.create({
        subject: "Panel access is obstructed",
      })
      const report = yield* feedback.create({
        title: "Panel access is obstructed",
        description: "The cover cannot be removed with the machine in place.",
        source: "Field inspection",
        links: { reporter: reporter.id, owner: owner.id, tickets: [source.id] },
      })
      expect(report.status).toBe("new")
      expect(report.links.tasks).toMatchObject({ ids: [], totalSize: 0 })

      const investigation = yield* tasks.create({
        title: "Measure the service clearance",
      })
      const redesign = yield* tasks.create({ title: "Revise the access cover" })
      yield* feedback.update({
        id: report.id,
        status: "reviewed",
        reviewNotes: "Verify the clearance and revise the cover if needed.",
        links: { tasks: [investigation.id, redesign.id] },
      })
      const second = yield* feedback.create({
        title: "Cover removal takes two people",
        links: { tasks: [redesign.id] },
      })
      expect(
        (yield* tasks.get({ id: redesign.id })).links.feedback
      ).toMatchObject({
        totalSize: 2,
        totalSizeExact: true,
      })
      expect(
        (yield* tickets.get({ id: source.id })).links.feedback
      ).toMatchObject({ ids: [report.id] })
      // Evidence about a ticket does not also claim the ticket directly requested every task.
      expect((yield* tickets.get({ id: source.id })).links.tasks).toMatchObject(
        { totalSize: 0 }
      )

      yield* tasks.update({ id: redesign.id, status: "done" })
      expect((yield* feedback.get({ id: second.id })).status).toBe("new")
      expect((yield* feedback.get({ id: report.id })).status).toBe("reviewed")

      yield* tasks.delete({ id: redesign.id })
      yield* tickets.delete({ id: source.id })
      const retained = yield* feedback.get({ id: report.id })
      expect(retained.description).toBe(report.description)
      expect(retained.links.tasks).toMatchObject({ ids: [investigation.id] })
      expect(retained.links.tickets).toMatchObject({ totalSize: 0 })
      yield* feedback.delete({ id: report.id })
      expect((yield* tasks.get({ id: investigation.id })).title).toBe(
        "Measure the service clearance"
      )
    })
)
