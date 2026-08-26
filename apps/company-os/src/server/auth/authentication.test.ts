import { fileURLToPath } from "node:url"

import { EmailAddress, RecordId, Timestamp } from "@company/runtime"
import { CurrentInvocation } from "@company/runtime/effect/object-service"
import { PgliteClient } from "@effect/sql-pglite"
import { eq } from "drizzle-orm"
import * as PgliteDrizzle from "drizzle-orm/effect-pglite"
import { migrate } from "drizzle-orm/effect-pglite/migrator"
import { Effect, Layer, Redacted } from "effect"
import { describe, expect, it } from "vitest"

import { AuthorizationRepository } from "@/server/authorization/authorization-repository"
import { Authorization } from "@/server/authorization/authorization-service"
import { Database } from "@/server/database/database"
import {
  authUser,
  authUserBindings,
  relations,
  roleAssignments,
} from "@/server/database/schema"
import { ApiKeyRepository } from "@/server/objects/api-key-repository"
import { ApiKeyService } from "@/server/objects/api-key-service"
import { InvitationRepository } from "@/server/objects/invitation-repository"
import { InvitationService } from "@/server/objects/invitation-service"
import { RecordIdentifierResolver } from "@/server/objects/record-identifier-resolver"
import { RoleAssignmentRepository } from "@/server/objects/role-assignment-repository"
import { RoleAssignmentService } from "@/server/objects/role-assignment-service"
import { RoleRepository } from "@/server/objects/role-repository"
import { ServiceAccountRepository } from "@/server/objects/service-account-repository"
import { ServiceAccountService } from "@/server/objects/service-account-service"
import { UserRepository } from "@/server/objects/user-repository"
import { UserService } from "@/server/objects/user-service"
import { seedSystem } from "@/server/seeds/seed-system"
import { PLATFORM_ADMIN_ROLE_ID, PLATFORM_ID } from "@/system-records"

import { ApiKeyAuthentication } from "./api-key-authentication"
import { AuthSettings, type AuthConfig } from "./auth-config"
import { AuthProtocol, type AuthUser } from "./auth-protocol"
import { Authentication } from "./authentication"
import { IdentityBindingRepository } from "./identity-binding-repository"
import { UserAuthentication } from "./user-authentication"

const migrationsFolder = fileURLToPath(
  new URL("../database/migrations", import.meta.url)
)
const TestDatabase = PgliteClient.layer()

const authConfig: AuthConfig = {
  baseUrl: "http://localhost:3002",
  bootstrapEmail: undefined,
  cookiePrefix: "company_os_test",
  oidc: {
    clientId: "client-id",
    clientSecret: Redacted.make("client-secret"),
    discoveryUrl:
      "https://accounts.example.com/.well-known/openid-configuration",
    name: "Single sign-on",
  },
  secret: Redacted.make("a-secure-value-with-at-least-32-characters"),
}

const authUsers = new Map<string, AuthUser>([
  [
    "auth_owner",
    {
      authUserId: "auth_owner",
      email: "owner@example.com",
      emailVerified: true,
      name: "Owner",
    },
  ],
  [
    "auth_other",
    {
      authUserId: "auth_other",
      email: "other@example.com",
      emailVerified: true,
      name: "Other",
    },
  ],
])

const testAuthProtocol = {
  handle: (_request: Request) => Effect.die("Not used by authentication tests"),
  session: (headers: Headers) =>
    Effect.succeed(
      authUsers.get(headers.get("x-test-auth-user") ?? "") ?? null
    ),
} satisfies typeof AuthProtocol.Service

function userHeaders(authUserId: string): Headers {
  return new Headers({ "x-test-auth-user": authUserId })
}

function asDatabase(
  database: Effect.Success<
    ReturnType<typeof PgliteDrizzle.makeWithDefaults<typeof relations>>
  >
): typeof Database.Service {
  // SAFETY: the Effect PostgreSQL and PGlite drivers implement the same
  // Drizzle query and transaction API; only the client is replaced in tests.
  // oxlint-disable-next-line anti-slop/no-chained-type-assertions, typescript/no-unsafe-type-assertion
  return database as unknown as typeof Database.Service
}

function run<A, E>(effect: Effect.Effect<A, E, PgliteClient.PgliteClient>) {
  return Effect.runPromise(
    Effect.scoped(effect.pipe(Effect.provide(TestDatabase)))
  )
}

function makeTestApplication(
  database: typeof Database.Service,
  config: AuthConfig
) {
  const databaseLayer = Layer.succeed(Database, database)
  const repositoriesLayer = Layer.mergeAll(
    ApiKeyRepository.layer,
    AuthorizationRepository.layer,
    IdentityBindingRepository.layer,
    InvitationRepository.layer,
    RoleAssignmentRepository.layer,
    RoleRepository.layer,
    ServiceAccountRepository.layer,
    UserRepository.layer
  ).pipe(Layer.provide(databaseLayer))
  const authorizationLayer = Authorization.layer.pipe(
    Layer.provide(repositoriesLayer)
  )
  const recordIdentifierResolverLayer = RecordIdentifierResolver.layer.pipe(
    Layer.provide(databaseLayer)
  )
  const applicationDependencies = Layer.mergeAll(
    authorizationLayer,
    databaseLayer,
    recordIdentifierResolverLayer,
    repositoriesLayer
  )
  const coreServicesLayer = Layer.mergeAll(
    ApiKeyService.layer,
    RoleAssignmentService.layer,
    ServiceAccountService.layer,
    UserService.layer
  ).pipe(Layer.provide(applicationDependencies))
  const invitationServiceLayer = InvitationService.layer.pipe(
    Layer.provide(coreServicesLayer),
    Layer.provide(applicationDependencies)
  )
  const userAuthenticationLayer = UserAuthentication.layer.pipe(
    Layer.provide(Layer.succeed(AuthSettings, config)),
    Layer.provide(Layer.succeed(AuthProtocol, testAuthProtocol)),
    Layer.provide(coreServicesLayer),
    Layer.provide(applicationDependencies)
  )
  const apiKeyAuthenticationLayer = ApiKeyAuthentication.layer.pipe(
    Layer.provide(repositoriesLayer)
  )
  const authenticationLayer = Authentication.layer.pipe(
    Layer.provide(
      Layer.merge(userAuthenticationLayer, apiKeyAuthenticationLayer)
    )
  )
  return Layer.mergeAll(
    authenticationLayer,
    userAuthenticationLayer,
    invitationServiceLayer,
    apiKeyAuthenticationLayer,
    coreServicesLayer,
    databaseLayer
  )
}

function setupTestApplication(
  authUserIds: ReadonlyArray<string>,
  config: AuthConfig = authConfig
) {
  return Effect.gen(function* () {
    const pglite = yield* PgliteDrizzle.makeWithDefaults({ relations })
    yield* migrate(pglite, { migrationsFolder })
    const database = asDatabase(pglite)
    yield* seedSystem().pipe(Effect.provideService(Database, database))
    for (const authUserId of authUserIds) {
      const user = authUsers.get(authUserId)
      if (user === undefined) {
        return yield* Effect.die(`Unknown test auth user: ${authUserId}`)
      }
      yield* database.insert(authUser).values({
        createdAt: new Date(),
        email: user.email,
        emailVerified: user.emailVerified,
        id: user.authUserId,
        name: user.name,
        updatedAt: new Date(),
      })
    }
    return {
      application: makeTestApplication(database, config),
      database,
    }
  })
}

describe("authentication", () => {
  it("bootstraps the first verified User as Platform Administrator", async () => {
    const result = await run(
      Effect.gen(function* () {
        const { application, database } = yield* setupTestApplication([
          "auth_owner",
          "auth_other",
        ])

        return yield* Effect.gen(function* () {
          const userAuthentication = yield* UserAuthentication
          const users = yield* UserService
          const authentication = yield* Authentication
          const anonymousCaller = yield* authentication.identify(new Headers())
          const authenticatedCaller = yield* authentication.identify(
            userHeaders("auth_owner")
          )
          const owner = yield* userAuthentication.authenticate(
            userHeaders("auth_owner")
          )
          const sameOwner = yield* userAuthentication.authenticate(
            userHeaders("auth_owner")
          )
          const userInvocation = yield* authentication.authenticate(
            userHeaders("auth_owner")
          )
          const identityCaller = yield* authentication.identify(
            userHeaders("auth_owner")
          )
          const rejected = yield* userAuthentication
            .authenticate(userHeaders("auth_other"))
            .pipe(Effect.flip)
          const lastAdministrator = yield* users
            .suspend(owner.id)
            .pipe(
              Effect.provideService(CurrentInvocation, { actorId: owner.id }),
              Effect.flip
            )
          const bindings = yield* database.select().from(authUserBindings)
          const administratorAssignments = yield* database
            .select()
            .from(roleAssignments)
            .where(eq(roleAssignments.roleId, PLATFORM_ADMIN_ROLE_ID))

          return {
            administratorAssignments,
            anonymousCaller,
            authenticatedCaller,
            bindings,
            identityCaller,
            lastAdministrator,
            owner,
            rejected,
            sameOwner,
            userInvocation,
          }
        }).pipe(Effect.provide(application))
      })
    )

    expect(result.owner).toEqual(result.sameOwner)
    expect(result.anonymousCaller).toEqual({ kind: "anonymous" })
    expect(result.authenticatedCaller).toEqual({ kind: "authenticated" })
    expect(result.identityCaller).toEqual({
      identityId: result.owner.id,
      kind: "identity",
    })
    expect(result.userInvocation).toEqual({ actorId: result.owner.id })
    expect(result.bindings).toEqual([
      expect.objectContaining({ authUserId: "auth_owner" }),
    ])
    expect(result.administratorAssignments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          parentId: PLATFORM_ID,
          principalId: result.owner.id,
        }),
      ])
    )
    expect(result.rejected).toMatchObject({ _tag: "InvitationRequired" })
    expect(result.lastAdministrator).toMatchObject({
      _tag: "LastActivePlatformAdministrator",
    })
  })

  it("optionally restricts the first User by verified email", async () => {
    const rejection = await run(
      Effect.gen(function* () {
        const { application } = yield* setupTestApplication(["auth_other"], {
          ...authConfig,
          bootstrapEmail: EmailAddress("owner@example.com"),
        })

        return yield* UserAuthentication.pipe(
          Effect.flatMap((authentication) =>
            authentication.authenticate(userHeaders("auth_other"))
          ),
          Effect.flip,
          Effect.provide(application)
        )
      })
    )

    expect(rejection).toMatchObject({ _tag: "FirstUserRejected" })
  })

  it("provisions an invited User and consumes the invitation", async () => {
    const result = await run(
      Effect.gen(function* () {
        const { application, database } = yield* setupTestApplication([
          "auth_owner",
          "auth_other",
        ])
        return yield* Effect.gen(function* () {
          const userAuthentication = yield* UserAuthentication
          const invitations = yield* InvitationService
          const owner = yield* userAuthentication.authenticate(
            userHeaders("auth_owner")
          )
          const issued = yield* invitations
            .issue({
              email: EmailAddress("other@example.com"),
              expiresAt: Timestamp(new Date(Date.now() + 60_000).toISOString()),
              role: PLATFORM_ADMIN_ROLE_ID,
              scope: RecordId("authorizationScope")(PLATFORM_ID),
            })
            .pipe(
              Effect.provideService(CurrentInvocation, { actorId: owner.id })
            )
          const accepted = yield* userAuthentication.acceptInvitation(
            userHeaders("auth_other"),
            issued.invitation,
            issued.redemptionToken
          )
          const invitedUser = yield* userAuthentication.authenticate(
            userHeaders("auth_other")
          )
          const reusedInvitation = yield* userAuthentication
            .acceptInvitation(
              userHeaders("auth_other"),
              issued.invitation,
              issued.redemptionToken
            )
            .pipe(Effect.flip)
          const bindings = yield* database.select().from(authUserBindings)
          return { accepted, bindings, invitedUser, reusedInvitation }
        }).pipe(Effect.provide(application))
      })
    )

    expect(result.accepted.user).toBe(result.invitedUser.id)
    expect(result.bindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ authUserId: "auth_owner" }),
        expect.objectContaining({ authUserId: "auth_other" }),
      ])
    )
    expect(result.reusedInvitation).toMatchObject({
      _tag: "InvitationInvalid",
      reason: "token",
    })
  })

  it("authenticates and revokes ServiceAccount API keys", async () => {
    const result = await run(
      Effect.gen(function* () {
        const { application } = yield* setupTestApplication(["auth_owner"])
        return yield* Effect.gen(function* () {
          const userAuthentication = yield* UserAuthentication
          const authentication = yield* Authentication
          const apiKeys = yield* ApiKeyService
          const apiKeyAuthentication = yield* ApiKeyAuthentication
          const serviceAccounts = yield* ServiceAccountService
          const owner = yield* userAuthentication.authenticate(
            userHeaders("auth_owner")
          )
          const serviceAccount = yield* serviceAccounts
            .create({ description: null, name: "Test automation" })
            .pipe(
              Effect.provideService(CurrentInvocation, { actorId: owner.id })
            )
          const issued = yield* apiKeys
            .issue({ name: "Test key", serviceAccount: serviceAccount.id })
            .pipe(
              Effect.provideService(CurrentInvocation, { actorId: owner.id })
            )
          const authenticatedKey = yield* apiKeyAuthentication.authenticate(
            `Bearer ${issued.secret}`
          )
          const invocation = yield* authentication.authenticate(
            new Headers({ authorization: `Bearer ${issued.secret}` })
          )
          const unsupportedAuthorization = yield* authentication
            .authenticate(
              new Headers({ authorization: "Bearer external-token" })
            )
            .pipe(Effect.flip)
          yield* serviceAccounts
            .disable(serviceAccount.id)
            .pipe(
              Effect.provideService(CurrentInvocation, { actorId: owner.id })
            )
          const disabledAccountKey = yield* apiKeyAuthentication
            .authenticate(`Bearer ${issued.secret}`)
            .pipe(Effect.flip)
          yield* serviceAccounts
            .enable(serviceAccount.id)
            .pipe(
              Effect.provideService(CurrentInvocation, { actorId: owner.id })
            )
          const reenabledAccountKey = yield* apiKeyAuthentication.authenticate(
            `Bearer ${issued.secret}`
          )
          yield* apiKeys
            .revoke(issued.apiKey)
            .pipe(
              Effect.provideService(CurrentInvocation, { actorId: owner.id })
            )
          const revokedKey = yield* apiKeyAuthentication
            .authenticate(`Bearer ${issued.secret}`)
            .pipe(Effect.flip)
          return {
            authenticatedKey,
            disabledAccountKey,
            invocation,
            reenabledAccountKey,
            revokedKey,
            serviceAccount,
            unsupportedAuthorization,
          }
        }).pipe(Effect.provide(application))
      })
    )

    expect(result.authenticatedKey.serviceAccountId).toBe(
      result.serviceAccount.id
    )
    expect(result.invocation).toEqual({ actorId: result.serviceAccount.id })
    expect(result.disabledAccountKey).toMatchObject({ _tag: "InvalidApiKey" })
    expect(result.reenabledAccountKey.serviceAccountId).toBe(
      result.serviceAccount.id
    )
    expect(result.revokedKey).toMatchObject({ _tag: "InvalidApiKey" })
    expect(result.unsupportedAuthorization).toMatchObject({
      _tag: "UnsupportedAuthorization",
    })
  })
})
