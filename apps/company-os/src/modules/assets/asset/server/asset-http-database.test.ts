import { createModelClient } from "@company/runtime/client/http-client"
import { ROOT_ID } from "@company/runtime/model/system-records"
import { AssetService } from "@company/runtime/server/assets/asset-service"
import { Authentication } from "@company/runtime/server/auth/authentication"
import { IdentityProvider } from "@company/runtime/server/auth/identity-provider"
import { Database } from "@company/runtime/server/database/database"
import { CurrentInvocation } from "@company/runtime/server/invocation"
import { PageTokens } from "@company/runtime/server/page-tokens"
import { ConfigProvider, Effect, Layer, Schema } from "effect"
import { FetchHttpClient } from "effect/unstable/http"
import { HttpApiClient } from "effect/unstable/httpapi"
import { expect } from "vitest"

import { makeApplicationLayer } from "#/examples/application.server.ts"
import { applicationHttpApi } from "#/examples/http-api.ts"
import { Model } from "#/examples/model.ts"
import { itDatabase } from "#/server/database/it-database.ts"
import { seedSystem } from "#/server/seeds/seed-system.ts"
import { HttpTransport } from "#/server/transport/http-transport.ts"

itDatabase(
  "routes colon actions through the generated HTTP contract and publishes committed write scopes",
  Effect.fn(function* () {
    const database = yield* Database
    yield* seedSystem().pipe(Effect.provide(PageTokens.layerTest))
    const subject = {
      issuer: "test",
      subject: "owner",
      kind: "user" as const,
      name: "Owner",
      email: "owner@example.test",
    }
    yield* Effect.gen(function* () {
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
        scope: ROOT_ID,
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
      const leadResponse = yield* send("leads", {
        name: "Buyer",
        companyName: "Foundation customer",
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
        "company",
        "contact",
        "lead",
      ])
      const repeat = yield* send(`leads/${lead.id}:convert`)
      expect(repeat.status).toBe(200)
      expect(repeat.headers.get("x-model-changes")).toBeNull()
      const companyResponse = yield* send("companies", { name: "Cascade test" })
      const company = Schema.decodeUnknownSync(
        Schema.Struct({ id: Schema.String })
      )(yield* Effect.promise(() => companyResponse.json()))
      const contactResponse = yield* send("contacts", {
        name: "Linked contact",
        links: { primaryCompany: company.id },
      })
      const contact = Schema.decodeUnknownSync(
        Schema.Struct({ id: Schema.String })
      )(yield* Effect.promise(() => contactResponse.json()))
      const deleted = yield* api.handle(
        new Request(`http://company.test/api/v1/companies/${company.id}`, {
          method: "DELETE",
        })
      )
      expect(deleted.status).toBe(204)
      expect(deleted.headers.get("x-model-changes")).toBe("company,contact")
      const remaining = yield* api.handle(
        new Request(
          `http://company.test/api/v1/contacts/${contact.id}/primaryCompany`
        )
      )
      expect(yield* Effect.promise(() => remaining.json())).toMatchObject({
        items: [],
        totalSize: 0,
      })
      const batchCompanyResponse = yield* send("companies", {
        name: "Batch cascade",
        links: { contacts: [contact.id] },
      })
      const batchCompany = Schema.decodeUnknownSync(
        Schema.Struct({ id: Schema.String })
      )(yield* Effect.promise(() => batchCompanyResponse.json()))
      const batchDeleted = yield* send("companies:batchDelete", {
        ids: [batchCompany.id],
      })
      expect(batchDeleted.status).toBe(204)
      expect(batchDeleted.headers.get("x-model-changes")).toBe(
        "company,contact"
      )
    }).pipe(
      Effect.provide(
        makeApplicationLayer({
          database: Layer.succeed(Database, database),
          pageTokens: PageTokens.layerTest,
          identityProvider: Layer.succeed(IdentityProvider, {
            identify: () =>
              Effect.succeed({ actor: subject, authorizationSubject: subject }),
          }),
        }).pipe(
          Layer.provide(
            ConfigProvider.layer(
              ConfigProvider.fromEnvRecord({
                AUTH_BOOTSTRAP_ISSUER: "test",
                AUTH_BOOTSTRAP_SUBJECT: "owner",
              })
            )
          )
        )
      )
    )
  })
)
