import { ConfigProvider, Effect, Layer } from "effect"
import { expect } from "vitest"

import { ADMINISTRATOR_ROLE_ID } from "#/runtime/model/system-records.ts"
import { Authentication } from "#/runtime/server/auth/authentication.ts"
import { IdentityBindingRepository } from "#/runtime/server/auth/identity-binding-repository.ts"
import { IdentityProvider } from "#/runtime/server/auth/identity-provider.ts"
import { Database } from "#/runtime/server/storage/database.ts"
import {
  tableProjection,
  type TableRow,
} from "#/runtime/server/storage/index.ts"
import { fixtureModel } from "#/runtime/testing/fixture-model.ts"
import { FixtureServer } from "#/runtime/testing/fixture-server.ts"
import { testFoundation } from "#/runtime/testing/foundation.ts"

const fixture = testFoundation(fixtureModel, { servers: [FixtureServer] })
const roleAssignments = fixture.storage.objects.roleAssignment

fixture.test(
  "shares verification within a request and reserves bootstrap for the configured subject",
  () =>
    Effect.gen(function* () {
      const { sql } = yield* Database
      let verifications = 0
      const provider = Layer.succeed(IdentityProvider, {
        identify: (headers: Headers) =>
          Effect.sync(() => {
            verifications++
            const subject = headers.get("x-test-subject") ?? "member"
            const identity = {
              issuer: "test",
              subject,
              kind: "user" as const,
              email: `${subject}@example.test`,
              name: subject,
            }
            return { actor: identity, authorizationSubject: identity }
          }),
      })
      const authentication = yield* Authentication.pipe(
        Effect.provide(
          Authentication.layer.pipe(
            Layer.provide(
              Layer.mergeAll(
                provider,
                IdentityBindingRepository.layer,
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
      )
      const firstRequest = new Headers()
      const first = yield* authentication.currentUser(firstRequest)
      yield* authentication.identify(firstRequest)
      yield* authentication.invocation(firstRequest)
      expect(verifications).toBe(1)
      expect(first).not.toBeNull()
      const firstGrants = yield* sql<
        TableRow<typeof roleAssignments>
      >`select ${tableProjection(roleAssignments)}
          from ${roleAssignments}
          where ${roleAssignments.columns.principalId} = ${first!.id}`
      expect(firstGrants).toEqual([])
      const owner = yield* authentication.currentUser(
        new Headers({ "x-test-subject": "owner" })
      )
      expect(owner).not.toBeNull()
      const ownerGrants = yield* sql<
        TableRow<typeof roleAssignments>
      >`select ${tableProjection(roleAssignments)}
          from ${roleAssignments}
          where ${roleAssignments.columns.principalId} = ${owner!.id}`
      expect(ownerGrants.map((grant) => grant.roleId)).toEqual([
        ADMINISTRATOR_ROLE_ID,
      ])
      yield* authentication.currentUser(new Headers())
      expect(verifications).toBe(3)
    })
)
