import { EmailAddress, type ListRequest } from "@company/runtime/model"
import { Database } from "@company/runtime/server/database/database"
import { CurrentInvocation } from "@company/runtime/server/invocation"
import { systemInvocation } from "@company/runtime/server/invocation-context"
import { PageTokens } from "@company/runtime/server/page-tokens"
import { objectListRequest } from "@company/runtime/ui/model/object-collection-query"
import { contactViews } from "@company/sales/ui"
import { Effect, Layer } from "effect"
import { expect } from "vitest"

import { makeApplicationLayer } from "#/examples/application.server.ts"
import { Model } from "#/examples/model.ts"
import { ModelImplementation } from "#/examples/services.server.ts"
import { itDatabase } from "#/server/database/it-database.ts"
import { seedSystem } from "#/server/seeds/seed-system.ts"

itDatabase(
  "defaults contacts out of marketing and keeps audience selection separate from consent",
  Effect.fn(function* () {
    const database = yield* Database
    yield* seedSystem().pipe(Effect.provide(PageTokens.layerTest))
    yield* Effect.gen(function* () {
      const { services } = yield* ModelImplementation
      const fresh = yield* services.contact.create({ name: "New contact" })
      expect(fresh.marketingStatus).toBe("nonMarketing")
      expect(fresh.emailPermission).toBe("unknown")
      const included = yield* services.contact.update({
        id: fresh.id,
        etag: fresh.etag,
        marketingStatus: "marketing",
      })
      expect(included.emailPermission).toBe("unknown")
      for (const [name, marketingStatus, emailPermission, email] of [
        ["Eligible", "marketing", "optedIn", "eligible@example.test"],
        ["Not marketing", "nonMarketing", "optedIn", "excluded@example.test"],
        ["No consent", "marketing", "unknown", "unknown@example.test"],
        ["Opted out", "marketing", "optedOut", "out@example.test"],
        ["Missing email", "marketing", "optedIn", null],
      ] as const) {
        yield* services.contact.create({
          name,
          marketingStatus,
          emailPermission,
          email: email === null ? null : EmailAddress(email),
        })
      }
      const view = contactViews.find(({ id }) => id === "marketing-email")!
      const viewRequest = objectListRequest(
        Model.objects.contact,
        view.state.filters,
        view.state.sorting
      )
      const request = {
        pageSize: 50,
        filter: {
          and: [
            { field: "marketingStatus", operator: "eq", value: "marketing" },
            { field: "emailPermission", operator: "eq", value: "optedIn" },
            { not: { field: "email", operator: "isNull" } },
          ],
        },
      } satisfies ListRequest<typeof Model.objects.contact>
      expect(viewRequest).toEqual(request)
      const audience = yield* services.contact.list(request)
      expect(audience.items.map(({ name }) => name)).toEqual(["Eligible"])
      expect(audience.totalSize).toBe(1)
      const eligible = audience.items[0]!
      yield* services.contact.update({
        id: eligible.id,
        etag: eligible.etag,
        emailPermission: "optedOut",
      })
      expect((yield* services.contact.list(request)).totalSize).toBe(0)
    }).pipe(
      Effect.provide(
        makeApplicationLayer({
          database: Layer.succeed(Database, database),
          pageTokens: PageTokens.layerTest,
        })
      ),
      Effect.provideService(CurrentInvocation, systemInvocation)
    )
  })
)
