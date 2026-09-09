import { Effect } from "effect"
import { OpenApi } from "effect/unstable/httpapi"
import { expect } from "vitest"

import { Model } from "#/app.model.ts"
import { SalesServer } from "#/modules/sales/server/index.ts"
import { SupportEngineeringServer } from "#/modules/support-engineering/server/index.ts"
import { Ticket } from "#/modules/support/model/index.ts"
import { createApplicationHttpApi } from "#/runtime/contract/application-http-api.ts"
import {
  enableModules,
  modelObjectLinkTraversals,
} from "#/runtime/model/index.ts"
import { EventJournal } from "#/runtime/server/events/event-journal.ts"
import { modelImplementation } from "#/runtime/server/model/implementation.ts"
import { Links } from "#/runtime/server/model/link-service.ts"
import { testFoundation } from "#/runtime/testing/foundation.ts"

// Persistence always runs on the complete model. Disabling a module only narrows
// what transports expose, so relationships into the hidden module still cascade
// and journal when the visible side changes.
const withoutEscalations = enableModules(Model, [
  "access",
  "assets",
  "notes",
  "sales",
  "marketing",
  "engineering",
  "support",
])
const fixture = testFoundation(Model, {
  servers: [SalesServer, SupportEngineeringServer],
})
const implementation = modelImplementation(Model)
const ticketIssues = modelObjectLinkTraversals(Model, Ticket).find(
  (traversal) => traversal.traversal.key === "issues"
)!

fixture.test(
  "keeps hidden relationships consistent when a linked record is deleted",
  () =>
    Effect.gen(function* () {
      const { services } = yield* implementation
      const journal = yield* EventJournal
      const links = yield* Links
      const ticket = yield* services.ticket.create({
        subject: "Export drops attachments",
        description: "Customer export is missing files.",
        priority: "high",
      })
      const issue = yield* services.issue.create({
        title: "Fix export",
        description: "Attachments are skipped.",
        priority: "high",
      })
      yield* links.link(ticketIssues, { id: ticket.id, target: issue.id })
      const checkpoint = yield* journal.list({ cursor: "now" })

      yield* services.issue.delete({ id: issue.id })

      const types = (yield* journal.list({
        cursor: checkpoint.nextCursor,
      })).items
        .map((event) => event.type)
        .sort()
      expect(types).toEqual(["issue.deleted", "ticketIssues.unlinked"])
      expect(
        (yield* links.list(ticketIssues, { id: ticket.id })).items
      ).toEqual([])
    })
)

fixture.test("exposes only enabled operations over HTTP", () =>
  Effect.gen(function* () {
    const { api } = createApplicationHttpApi(withoutEscalations)
    const paths = Object.keys(OpenApi.fromApi(api).paths)
    expect(paths.some((path) => path.startsWith("/api/v1/tickets"))).toBe(true)
    expect(paths.some((path) => path.includes("escalation"))).toBe(false)
    expect(paths.some((path) => path.includes("/tickets/{id}/issues"))).toBe(
      false
    )
    const complete = Object.keys(
      OpenApi.fromApi(createApplicationHttpApi(Model).api).paths
    )
    expect(complete.some((path) => path.includes("escalation"))).toBe(true)
    yield* Effect.void
  })
)
