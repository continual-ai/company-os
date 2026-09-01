import type { IdentityId } from "@company/model"
import { EmailAddress, RecordId } from "@company/runtime"
import { CurrentInvocation } from "@company/runtime/effect/object-service"
import { Context, Data, Effect, Layer } from "effect"

import type { AuthenticatedUser } from "@/authentication"
import { anonymousCaller, identityCaller } from "@/server/caller"
import { Database } from "@/server/database/database"
import {
  anonymousInvocation,
  authenticatedInvocation,
  systemInvocation,
} from "@/server/invocation-context"
import { RoleAssignmentService } from "@/server/modules/access/role-assignment-service"
import { ServiceAccountService } from "@/server/modules/access/service-account-service"
import { UserService } from "@/server/modules/access/user-service"

import {
  IdentityBindingRepository,
  type BoundIdentity,
} from "./identity-binding-repository"
import {
  IdentityProvider,
  type AuthenticatedSubject,
  type VerifiedIdentityInvocation,
} from "./identity-provider"

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
          yield* roleAssignments.provisionInitialUserRole(identity.id)
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

  const identify = Effect.fn("@company/Authentication.identify")(function* (
    headers: Headers
  ) {
    const verified = yield* provider.identify(headers)
    if (verified === null) return anonymousCaller
    return identityCaller(
      (yield* resolveInvocation(verified)).authorizationIdentity.id
    )
  })

  const invocation = Effect.fn("@company/Authentication.invocation")(function* (
    headers: Headers
  ) {
    const verified = yield* provider.identify(headers)
    if (verified === null) return anonymousInvocation
    const resolved = yield* resolveInvocation(verified)
    return yield* authenticatedInvocation(
      resolved.actor.id,
      resolved.authorizationIdentity.id
    )
  })

  const currentUser = Effect.fn("@company/Authentication.currentUser")(
    function* (headers: Headers) {
      const verified = yield* provider.identify(headers)
      if (verified === null) return null
      const identity = (yield* resolveInvocation(verified))
        .authorizationIdentity
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
