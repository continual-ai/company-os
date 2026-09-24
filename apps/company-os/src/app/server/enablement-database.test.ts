import { Effect } from "effect"
import { OpenApi } from "effect/unstable/httpapi"
import { expect } from "vitest"

import { Model } from "#/app.model.ts"
import { CrmServer } from "#/modules/crm/server/index.ts"
import { EngineeringServer } from "#/modules/engineering/server/index.ts"
import { SalesServer } from "#/modules/sales/server/index.ts"
import { Ticket } from "#/modules/service/model/index.ts"
import { createApplicationHttpApi } from "#/runtime/contract/application-http-api.ts"
import {
  enableModules,
  modelObjectLinkTraversals,
} from "#/runtime/model/index.ts"
import { EventJournal } from "#/runtime/server/events/event-journal.ts"
import { operationsFor } from "#/runtime/server/operation-executor.ts"
import { Links } from "#/runtime/server/storage/link-store.ts"
import { testFoundation } from "#/runtime/testing/foundation.ts"

// Persistence always runs on the complete model. Disabling a module only narrows
// what transports expose, so links into the hidden module still cascade
// and journal when the visible side changes.
const withoutFeedback = enableModules(Model, [
  "platform",
  "crm",
  "work",
  "sales",
  "marketing",
  "engineering",
  "service",
])
const fixture = testFoundation(Model, {
  servers: [SalesServer, CrmServer, EngineeringServer],
})
const implementation = operationsFor(Model)
const ticketTasks = modelObjectLinkTraversals(Model, Ticket).find(
  (traversal) => traversal.traversal.key === "tasks"
)!

fixture.test(
  "keeps hidden links consistent when a linked record is deleted",
  () =>
    Effect.gen(function* () {
      const services = yield* implementation
      const journal = yield* EventJournal
      const links = yield* Links
      const ticket = yield* services.ticket.create({
        subject: "Export drops attachments",
        description: "Customer export is missing files.",
        priority: "high",
      })
      const task = yield* services.task.create({
        title: "Fix export",
        description: "Attachments are skipped.",
        priority: "high",
      })
      yield* links.link(ticketTasks, { id: ticket.id, target: task.id })
      const checkpoint = yield* journal.list({ cursor: "now" })

      yield* services.task.delete({ id: task.id })

      const types = (yield* journal.list({
        cursor: checkpoint.nextCursor,
      })).items
        .map((event) => event.type)
        .sort()
      expect(types).toEqual(["task.deleted", "ticketTasks.unlinked"])
      expect((yield* links.list(ticketTasks, { id: ticket.id })).items).toEqual(
        []
      )
    })
)

fixture.test("exposes only enabled operations over HTTP", () =>
  Effect.gen(function* () {
    const { api } = createApplicationHttpApi(withoutFeedback)
    const paths = Object.keys(OpenApi.fromApi(api).paths)
    expect(paths.some((path) => path.startsWith("/api/v1/tickets"))).toBe(true)
    expect(paths.some((path) => path.includes("/tickets/{id}/tasks"))).toBe(
      false
    )
    const complete = Object.keys(
      OpenApi.fromApi(createApplicationHttpApi(Model).api).paths
    )
    expect(complete.some((path) => path.includes("/tickets/{id}/tasks"))).toBe(
      true
    )
    yield* Effect.void
  })
)
