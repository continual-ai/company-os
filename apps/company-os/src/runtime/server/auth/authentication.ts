import { Config, Context, Data, Effect, Layer } from "effect"

import type { IdentityId } from "#/runtime/access/model/ids.ts"
import { RoleAssignmentService } from "#/runtime/access/server/role-assignment-service.ts"
import { ServiceAccountService } from "#/runtime/access/server/service-account-service.ts"
import { UserService } from "#/runtime/access/server/user-service.ts"
import type { AuthenticatedUser } from "#/runtime/client/authentication.ts"
import { EmailAddress, RecordId } from "#/runtime/model/index.ts"
import {
  IdentityBindingRepository,
  type BoundIdentity,
} from "#/runtime/server/auth/identity-binding-repository.ts"
import {
  IdentityProvider,
  type AuthenticatedSubject,
  type VerifiedIdentityInvocation,
} from "#/runtime/server/auth/identity-provider.ts"
import { anonymousCaller, identityCaller } from "#/runtime/server/caller.ts"
import {
  anonymousInvocation,
  authenticatedInvocation,
  systemInvocation,
} from "#/runtime/server/invocation-context.ts"
import { CurrentInvocation } from "#/runtime/server/invocation.ts"
import { Database } from "#/runtime/server/storage/database.ts"

class IdentityInactive extends Data.TaggedError("IdentityInactive")<{
  readonly identityId: IdentityId
}> {}

class IdentityProvisioningRequired extends Data.TaggedError(
  "IdentityProvisioningRequired"
)<{ readonly reason: "email" }> {}

class UserInterfaceRequired extends Data.TaggedError(
  "UserInterfaceRequired"
)<{}> {}

const make = Effect.gen(function* () {
  const bootstrapSubject = yield* Config.string("AUTH_BOOTSTRAP_SUBJECT").pipe(
    Config.withDefault("")
  )
  const bootstrapIssuer = yield* Config.string("AUTH_BOOTSTRAP_ISSUER").pipe(
    Config.withDefault("continual")
  )
  const defaultRole = yield* Config.string("AUTH_DEFAULT_ROLE").pipe(
    Config.withDefault("none")
  )
  if (defaultRole !== "none" && defaultRole !== "operator")
    return yield* Effect.die("AUTH_DEFAULT_ROLE must be none or operator.")
  const database = yield* Database
  const bindings = yield* IdentityBindingRepository
  const provider = yield* IdentityProvider
  const roleAssignments = yield* RoleAssignmentService
  const serviceAccounts = yield* ServiceAccountService
  const users = yield* UserService

  const emailAddress = Effect.fn("@company/Authentication.emailAddress")(
    function* (email: string) {
      return yield* Effect.try({
        try: () => EmailAddress(email.trim().toLowerCase()),
        catch: () => new IdentityProvisioningRequired({ reason: "email" }),
      })
    }
  )

  const requireActive = Effect.fn("@company/Authentication.requireActive")(
    function* (identity: BoundIdentity, subject: AuthenticatedSubject) {
      if (identity.kind === "user") {
        const record = yield* users.get({ id: identity.id })
        if (record.status !== "active") {
          return yield* Effect.fail(
            new IdentityInactive({ identityId: identity.id })
          )
        }
        yield* users.reconcile({
          email:
            subject.email === undefined
              ? record.email
              : yield* emailAddress(subject.email),
          id: identity.id,
          name: subject.name?.trim() || record.name,
        })
      } else {
        const record = yield* serviceAccounts.get({ id: identity.id })
        if (record.status !== "active") {
          return yield* Effect.fail(
            new IdentityInactive({ identityId: identity.id })
          )
        }
        yield* serviceAccounts.reconcile({
          id: identity.id,
          name: subject.name?.trim() || record.name,
        })
      }
      return identity
    }
  )

  const provision = Effect.fn("@company/Authentication.provision")(function* (
    subject: AuthenticatedSubject,
    grantInitialRole: boolean
  ) {
    return yield* database.transaction(() =>
      Effect.gen(function* () {
        const concurrent = yield* bindings.find(subject.issuer, subject.subject)
        if (concurrent !== undefined)
          return yield* requireActive(concurrent, subject)

        const identity = yield* subject.kind === "user"
          ? Effect.gen(function* () {
              if (subject.email === undefined) {
                return yield* Effect.fail(
                  new IdentityProvisioningRequired({ reason: "email" })
                )
              }
              const email = yield* emailAddress(subject.email)
              const user = yield* users.provision(
                subject.preferredIdentityId === undefined
                  ? { email, name: subject.name?.trim() || email }
                  : {
                      email,
                      id: RecordId("user")(subject.preferredIdentityId),
                      name: subject.name?.trim() || email,
                    }
              )
              return { id: user.id, kind: "user" as const }
            })
          : serviceAccounts
              .provision({
                description: `Provisioned from ${subject.issuer}.`,
                name: subject.name?.trim() || subject.subject,
              })
              .pipe(
                Effect.map((account) => ({
                  id: account.id,
                  kind: "serviceAccount" as const,
                }))
              )

        if (grantInitialRole) {
          const bootstrap =
            subject.issuer === bootstrapIssuer &&
            subject.subject === bootstrapSubject &&
            bootstrapSubject !== ""
          yield* roleAssignments.provisionInitialUserRole(
            identity.id,
            bootstrap ? "administrator" : defaultRole
          )
        }
        yield* bindings.bind({
          identityId: identity.id,
          issuer: subject.issuer,
          subject: subject.subject,
        })
        return identity
      }).pipe(Effect.provideService(CurrentInvocation, systemInvocation))
    )
  })

  const resolve = Effect.fn("@company/Authentication.resolve")(function* (
    subject: AuthenticatedSubject,
    grantInitialRole: boolean
  ) {
    const existing = yield* bindings.find(subject.issuer, subject.subject)
    return existing === undefined
      ? yield* provision(subject, grantInitialRole)
      : yield* requireActive(existing, subject).pipe(
          Effect.provideService(CurrentInvocation, systemInvocation)
        )
  })

  const resolveInvocation = Effect.fn(
    "@company/Authentication.resolveInvocation"
  )(function* (verified: VerifiedIdentityInvocation) {
    const authorizationIdentity = yield* resolve(
      verified.authorizationSubject,
      true
    )
    if (
      verified.actor.issuer === verified.authorizationSubject.issuer &&
      verified.actor.subject === verified.authorizationSubject.subject
    ) {
      return { actor: authorizationIdentity, authorizationIdentity }
    }
    return {
      actor: yield* resolve(verified.actor, false),
      authorizationIdentity,
    }
  })

  const resolveRequest = (headers: Headers) =>
    Effect.gen(function* () {
      const verified = yield* provider.identify(headers)
      return verified === null ? null : yield* resolveInvocation(verified)
    })
  // Headers belong to one incoming request. Weak keys avoid retaining credentials
  // or authorization state across requests while sharing concurrent consumers.
  const requests = new WeakMap<Headers, ReturnType<typeof resolveRequest>>()
  const requestIdentity = (headers: Headers) =>
    Effect.gen(function* () {
      const existing = requests.get(headers)
      if (existing !== undefined) return yield* existing
      const cached = yield* Effect.cached(resolveRequest(headers))
      requests.set(headers, cached)
      return yield* cached
    })

  const identify = Effect.fn("@company/Authentication.identify")(function* (
    headers: Headers
  ) {
    const resolved = yield* requestIdentity(headers)
    return resolved === null
      ? anonymousCaller
      : identityCaller(resolved.authorizationIdentity.id)
  })

  const invocation = Effect.fn("@company/Authentication.invocation")(function* (
    headers: Headers
  ) {
    const resolved = yield* requestIdentity(headers)
    if (resolved === null) return anonymousInvocation
    return yield* authenticatedInvocation(
      resolved.actor.id,
      resolved.authorizationIdentity.id
    )
  })

  const currentUser = Effect.fn("@company/Authentication.currentUser")(
    function* (headers: Headers) {
      const resolved = yield* requestIdentity(headers)
      if (resolved === null) return null
      const identity = resolved.authorizationIdentity
      if (identity.kind !== "user") {
        return yield* Effect.fail(new UserInterfaceRequired())
      }
      const user = yield* users
        .get({ id: identity.id })
        .pipe(Effect.provideService(CurrentInvocation, systemInvocation))
      return {
        email: user.email,
        id: user.id,
        name: user.name,
      } satisfies AuthenticatedUser
    }
  )

  return { currentUser, identify, invocation }
})

/** Maps verified provider identities to governed, role-assignable App principals. */
export class Authentication extends Context.Service<Authentication>()(
  "@company/Authentication",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
