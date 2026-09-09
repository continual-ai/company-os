import { Effect, Layer } from "effect"
import { expect } from "vitest"

import { Model } from "#/app.model.ts"
import { testApplication } from "#/app/server/test-application.ts"
import { HttpTransport } from "#/app/server/transport/http-transport.ts"
import { createEffectClient } from "#/runtime/client/create-client.ts"
import { EmailAddress, Timestamp } from "#/runtime/model/index.ts"
import { IdentityProvider } from "#/runtime/server/auth/identity-provider.ts"

const operator = {
  issuer: "test",
  subject: "recruiter",
  kind: "user" as const,
  name: "Recruiter",
  email: "recruiter@example.test",
}
const application = testApplication({
  configuration: { AUTH_DEFAULT_ROLE: "operator" },
  identityProvider: Layer.succeed(IdentityProvider, {
    identify: (headers) =>
      Effect.succeed(
        headers.get("x-test-recruiter") === "yes"
          ? { actor: operator, authorizationSubject: operator }
          : null
      ),
  }),
})

application.test(
  "operators discover hiring and manage applications through generated HTTP CRUD",
  () =>
    Effect.gen(function* () {
      const api = yield* HttpTransport
      const fetch: typeof globalThis.fetch = (input, init) =>
        Effect.runPromise(api.handle(new Request(input, init)))
      const client = createEffectClient(Model, {
        baseUrl: "http://company.test",
        fetch,
        headers: { "x-test-recruiter": "yes" },
      })
      const anonymous = createEffectClient(Model, {
        baseUrl: "http://company.test",
        fetch,
      })
      const checks = [
        { permission: "jobPosting.list" },
        { permission: "candidate.list" },
        { permission: "application.list" },
      ] as const
      expect(
        (yield* client.capabilities.check({ checks })).results.map(
          (result) => result.allowed
        )
      ).toEqual([true, true, true])
      expect(
        (yield* anonymous.capabilities.check({ checks })).results.map(
          (result) => result.allowed
        )
      ).toEqual([false, false, false])

      const publishedAt = Timestamp("2026-09-09T12:00:00.000Z")
      const job = yield* client.jobPosting.create({
        description: "Own the first version of the product.",
        title: "Founding engineer",
        status: "open",
        publishedAt,
      })
      expect(job.publishedAt).toBe(publishedAt)
      const candidate = yield* client.candidate.create({
        email: EmailAddress("maya@example.test"),
        name: "Maya Chen",
      })
      const submitted = yield* client.application.create({
        candidate: candidate.id,
        job: job.id,
      })
      expect(submitted.stage).toBe("new")
      const moved = yield* client.application.update({
        id: submitted.id,
        etag: submitted.etag,
        stage: "reviewing",
        reviewNotes: "Strong evidence of ownership.",
      })
      expect(
        (yield* client.application.list({
          filter: { field: "stage", operator: "eq", value: "reviewing" },
        })).items
      ).toMatchObject([
        {
          id: moved.id,
          stage: "reviewing",
          reviewNotes: "Strong evidence of ownership.",
        },
      ])
      expect(
        yield* anonymous.application
          .update({
            id: moved.id,
            etag: moved.etag,
            stage: "hired",
          })
          .pipe(Effect.flip)
      ).toMatchObject({ status: "NOT_FOUND" })
      expect((yield* client.application.get({ id: moved.id })).stage).toBe(
        "reviewing"
      )

      const closed = yield* client.jobPosting.update({
        id: job.id,
        etag: job.etag,
        status: "closed",
      })
      expect(closed.closedAt).toBeNull()
      const closedAt = Timestamp("2026-09-10T12:00:00.000Z")
      expect(
        (yield* client.jobPosting.update({
          id: closed.id,
          etag: closed.etag,
          closedAt,
        })).closedAt
      ).toBe(closedAt)
    })
)
