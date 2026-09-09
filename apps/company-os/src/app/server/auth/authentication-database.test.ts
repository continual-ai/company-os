import { ConfigProvider, Effect, Layer } from "effect"
import { expect } from "vitest"

import { makeApplicationLayer } from "#/app/server/application-layer.ts"
import { itDatabase } from "#/app/server/database/it-database.ts"
import { roleAssignments } from "#/app/server/database/schema.ts"
import { seedSystem } from "#/app/server/seeds/seed-system.ts"
import { ADMINISTRATOR_ROLE_ID } from "#/runtime/model/system-records.ts"
import { Authentication } from "#/runtime/server/auth/authentication.ts"
import { IdentityProvider } from "#/runtime/server/auth/identity-provider.ts"
import { Database } from "#/runtime/server/database/database.ts"
import { PageTokens } from "#/runtime/server/page-tokens.ts"
import {
  tableProjection,
  type TableRow,
} from "#/runtime/server/postgres/index.ts"

itDatabase(
  "shares verification within a request and reserves bootstrap for the configured subject",
  Effect.fn(function* () {
    const database = yield* Database
    const sql = database.sql
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
