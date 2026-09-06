import { eq } from "drizzle-orm"
import { ConfigProvider, Effect, Layer } from "effect"
import { expect } from "vitest"

import { makeApplicationLayer } from "@/server/application-layer"
import { Database } from "@/server/database/database"
import { itDatabase } from "@/server/database/it-database"
import { roleAssignments } from "@/server/database/schema"
import { PageTokens } from "@/server/page-tokens"
import { seedSystem } from "@/server/seeds/seed-system"
import { ADMINISTRATOR_ROLE_ID } from "@/system-records"

import { Authentication } from "./authentication"
import { IdentityProvider } from "./identity-provider"

itDatabase(
  "shares verification within a request and reserves bootstrap for the configured subject",
  Effect.fn(function* () {
    const database = yield* Database
    yield* seedSystem().pipe(Effect.provide(PageTokens.layerTest))
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
    yield* Effect.gen(function* () {
      const authentication = yield* Authentication
      const firstRequest = new Headers()
      const first = yield* authentication.currentUser(firstRequest)
      yield* authentication.identify(firstRequest)
      yield* authentication.invocation(firstRequest)
      expect(verifications).toBe(1)
      expect(first).not.toBeNull()
      const firstGrants = yield* database
        .select()
        .from(roleAssignments)
        .where(eq(roleAssignments.principalId, first!.id))
      expect(firstGrants).toEqual([])
      const owner = yield* authentication.currentUser(
        new Headers({ "x-test-subject": "owner" })
      )
      expect(owner).not.toBeNull()
      const ownerGrants = yield* database
        .select()
        .from(roleAssignments)
        .where(eq(roleAssignments.principalId, owner!.id))
      expect(ownerGrants.map((grant) => grant.roleId)).toEqual([
        ADMINISTRATOR_ROLE_ID,
      ])
      yield* authentication.currentUser(new Headers())
      expect(verifications).toBe(3)
    }).pipe(
      Effect.provide(
        makeApplicationLayer({
          database: Layer.succeed(Database, database),
          pageTokens: PageTokens.layerTest,
          identityProvider: provider,
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
