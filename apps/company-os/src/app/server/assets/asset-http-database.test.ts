import { Effect, Layer, Schema } from "effect"
import { FetchHttpClient } from "effect/unstable/http"
import { HttpApiClient } from "effect/unstable/httpapi"
import { expect } from "vitest"

import { Model } from "#/app.model.ts"
import { applicationHttpApi } from "#/app/server/http-api.ts"
import { testApplication } from "#/app/server/test-application.ts"
import { HttpTransport } from "#/app/server/transport/http-transport.ts"
import { AssetService } from "#/runtime/assets/server/asset-service.ts"
import { createModelClient } from "#/runtime/client/http-client.ts"
import { Authentication } from "#/runtime/server/auth/authentication.ts"
import { IdentityProvider } from "#/runtime/server/auth/identity-provider.ts"
import { CurrentInvocation } from "#/runtime/server/invocation.ts"

const subject = {
  issuer: "test",
  subject: "owner",
  kind: "user" as const,
  name: "Owner",
  email: "owner@example.test",
}
const application = testApplication({
  configuration: {},
  identityProvider: Layer.succeed(IdentityProvider, {
    identify: () => Effect.succeed(subject),
  }),
})

application.test(
  "routes colon actions through the generated HTTP contract and publishes committed write scopes",
  () =>
    Effect.gen(function* () {
      const api = yield* HttpTransport
      const authentication = yield* Authentication
      const assets = yield* AssetService
      const send = (path: string, body?: unknown) =>
        api.handle(
          new Request(`http://company.test/api/v1/${path}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          })
        )
      const reserve = yield* send("assets:beginUpload", {
        name: "review.txt",
        contentType: "text/plain",
        size: 3,
      })
      expect(reserve.status).toBe(200)
      expect(reserve.headers.get("x-model-changes")).toBe("asset")
      const reservation = Schema.decodeUnknownSync(
        Schema.Struct({ asset: Schema.String })
      )(yield* Effect.promise(() => reserve.json()))
      const pending = yield* send(`assets/${reservation.asset}:completeUpload`)
      expect(pending.status).toBe(400)
      expect(yield* Effect.promise(() => pending.json())).toMatchObject({
        status: "FAILED_PRECONDITION",
      })
      expect(pending.headers.get("x-model-changes")).toBeNull()
      const invocation = yield* authentication.invocation(new Headers())
      yield* assets
        .put(reservation.asset, new TextEncoder().encode("yes"))
        .pipe(Effect.provideService(CurrentInvocation, invocation))
      const complete = yield* send(`assets/${reservation.asset}:completeUpload`)
      expect(complete.status).toBe(200)
      expect(complete.headers.get("x-model-changes")).toBe("asset")
      const unknownAction = yield* send(`assets/${reservation.asset}:unknown`)
      expect(unknownAction.status).toBe(404)
      const leadAccountResponse = yield* send("accounts", {
        name: "Foundation customer",
      })
      const leadContactResponse = yield* send("contacts", { name: "Buyer" })
      const idSchema = Schema.Struct({ id: Schema.String })
      const leadAccount = Schema.decodeUnknownSync(idSchema)(
        yield* Effect.promise(() => leadAccountResponse.json())
      )
      const leadContact = Schema.decodeUnknownSync(idSchema)(
        yield* Effect.promise(() => leadContactResponse.json())
      )
      const leadResponse = yield* send("leads", {
        name: "Buyer",
        links: { account: leadAccount.id, contact: leadContact.id },
      })
      expect(leadResponse.status).toBe(201)
      const lead = Schema.decodeUnknownSync(
        Schema.Struct({ id: Schema.String })
      )(yield* Effect.promise(() => leadResponse.json()))
      const leadGet = yield* api.handle(
        new Request(`http://company.test/api/v1/leads/${lead.id}`)
      )
      expect(leadGet.status).toBe(200)
      expect(yield* Effect.promise(() => leadGet.json())).toMatchObject({
        id: lead.id,
        name: "Buyer",
      })
      const parameters = new URLSearchParams({
        filter: JSON.stringify({
          and: [
            { field: "name", operator: "eq", value: "Buyer" },
            { field: "status", operator: "eq", value: "new" },
          ],
        }),
        sort: JSON.stringify([{ field: "name", direction: "desc" }]),
        pageSize: "10",
      })
      const filtered = yield* api.handle(
        new Request(`http://company.test/api/v1/leads?${parameters}`)
      )
      expect(filtered.status).toBe(200)
      expect(yield* Effect.promise(() => filtered.json())).toMatchObject({
        items: [{ id: lead.id }],
        totalSize: 1,
        totalSizeExact: true,
        nextPageToken: null,
      })
      yield* Effect.gen(function* () {
        const transport = yield* HttpApiClient.make(applicationHttpApi, {
          baseUrl: "http://company.test",
        }).pipe(Effect.provide(FetchHttpClient.layer))
        const model = createModelClient(Model, transport)
        const listed = yield* model.lead.list({
          filter: { field: "name", operator: "eq", value: "Buyer" },
          sort: [{ field: "createdAt", direction: "desc" }],
          pageSize: 10,
        })
        expect(listed.items.map((item) => item.id)).toEqual([lead.id])
      }).pipe(
        Effect.provideService(FetchHttpClient.Fetch, (input, init) => {
          const request = new Request(input, init)
          expect(request.method).toBe("GET")
          expect(new URL(request.url).pathname).toBe("/api/v1/leads")
          return Effect.runPromise(api.handle(request))
        })
      )
      const malformed = yield* api.handle(
        new Request("http://company.test/api/v1/leads?filter=%7B")
      )
      expect(malformed.status).toBe(400)
      const retiredSearch = yield* send("leads:search", {})
      expect(retiredSearch.status).toBe(404)
      const conversion = yield* send(`leads/${lead.id}:convert`)
      expect(conversion.status).toBe(200)
      expect(conversion.headers.get("x-model-changes")?.split(",")).toEqual([
        "account",
        "contact",
        "lead",
        "opportunity",
      ])
      const repeat = yield* send(`leads/${lead.id}:convert`)
      expect(repeat.status).toBe(200)
      expect(repeat.headers.get("x-model-changes")).toBeNull()
      const companyResponse = yield* send("accounts", { name: "Cascade test" })
      const account = Schema.decodeUnknownSync(
        Schema.Struct({ id: Schema.String })
      )(yield* Effect.promise(() => companyResponse.json()))
      const activityResponse = yield* send("activities", {
        title: "Linked activity",
        links: { accounts: [account.id] },
      })
      const activity = Schema.decodeUnknownSync(
        Schema.Struct({ id: Schema.String })
      )(yield* Effect.promise(() => activityResponse.json()))
      const deleted = yield* api.handle(
        new Request(`http://company.test/api/v1/accounts/${account.id}`, {
          method: "DELETE",
        })
      )
      expect(deleted.status).toBe(204)
      expect(deleted.headers.get("x-model-changes")).toBe("account,activity")
      const remaining = yield* api.handle(
        new Request(
          `http://company.test/api/v1/activities/${activity.id}/accounts`
        )
      )
      expect(yield* Effect.promise(() => remaining.json())).toMatchObject({
        items: [],
        totalSize: 0,
        totalSizeExact: true,
      })
      const batchAccountResponse = yield* send("accounts", {
        name: "Batch cascade",
        links: { activities: [activity.id] },
      })
      const batchAccount = Schema.decodeUnknownSync(
        Schema.Struct({ id: Schema.String })
      )(yield* Effect.promise(() => batchAccountResponse.json()))
      const batchDeleted = yield* send("accounts:batchDelete", {
        ids: [batchAccount.id],
      })
      expect(batchDeleted.status).toBe(204)
      expect(batchDeleted.headers.get("x-model-changes")).toBe(
        "account,activity"
      )
    })
)
