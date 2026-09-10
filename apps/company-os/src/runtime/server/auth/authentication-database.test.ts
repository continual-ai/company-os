import { Effect, Layer } from "effect"
import { expect } from "vitest"

import { Authentication } from "#/runtime/server/auth/authentication.ts"
import { IdentityBindingRepository } from "#/runtime/server/auth/identity-binding-repository.ts"
import { IdentityProvider } from "#/runtime/server/auth/identity-provider.ts"
import { fixtureModel } from "#/runtime/testing/fixture-model.ts"
import { FixtureServer } from "#/runtime/testing/fixture-server.ts"
import { testFoundation } from "#/runtime/testing/foundation.ts"
const fixture = testFoundation(fixtureModel, { servers: [FixtureServer] })
fixture.test(
  "caches verification only within one request and rechecks admission despite a stored identity",
  () =>
    Effect.gen(function* () {
      let verifications = 0
      let admitted = true
      const provider = Layer.succeed(IdentityProvider, {
        identify: () =>
          Effect.sync(() => {
            verifications++
            return admitted
              ? {
                  issuer: "test",
                  subject: "member",
                  kind: "user" as const,
                  email: "member@example.test",
                  name: "Member",
                }
              : null
          }),
      })
      const authentication = yield* Authentication.pipe(
        Effect.provide(
          Authentication.layer.pipe(
            Layer.provide(
              Layer.merge(provider, IdentityBindingRepository.layer)
            )
          )
        )
      )
      const headers = new Headers()
      const first = yield* authentication.currentUser(headers)
      const invocation = yield* authentication.invocation(headers)
      yield* authentication.invocation(headers)
      expect(verifications).toBe(1)
      expect(invocation.actorId).toBe(first!.id)
      expect((yield* authentication.currentUser(new Headers()))?.id).toBe(
        first!.id
      )
      admitted = false
      expect(yield* authentication.currentUser(new Headers())).toBeNull()
      expect(verifications).toBe(3)
    })
)
