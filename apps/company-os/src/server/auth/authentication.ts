import type { IdentityId } from "@company/model"
import { EmailAddress } from "@company/runtime"
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
import { RoleAssignmentService } from "@/server/objects/role-assignment-service"
import { ServiceAccountService } from "@/server/objects/service-account-service"
import { UserService } from "@/server/objects/user-service"
import {
  PLATFORM_ADMIN_ROLE_ID,
  PLATFORM_ID,
  PLATFORM_OPERATOR_ROLE_ID,
} from "@/system-records"

import { AuthSettings } from "./auth-config"
import {
  IdentityBindingRepository,
  type BoundIdentity,
} from "./identity-binding-repository"
import {
  IdentityProvider,
  type AuthenticatedSubject,
} from "./identity-provider"

class IdentityInactive extends Data.TaggedError("IdentityInactive")<{
  readonly identityId: IdentityId
}> {}

class IdentityProvisioningRequired extends Data.TaggedError(
  "IdentityProvisioningRequired"
)<{ readonly reason: "email" | "kind" }> {}

class UserInterfaceRequired extends Data.TaggedError(
  "UserInterfaceRequired"
)<{}> {}

const make = Effect.gen(function* () {
  const config = yield* AuthSettings
  const database = yield* Database
  const bindings = yield* IdentityBindingRepository
  const provider = yield* IdentityProvider
  const roleAssignments = yield* RoleAssignmentService
  const serviceAccounts = yield* ServiceAccountService
  const users = yield* UserService

  const requireActive = Effect.fn("@company/Authentication.requireActive")(
    function* (identity: BoundIdentity) {
      const record =
        identity.kind === "user"
          ? yield* users.get({ id: identity.id })
          : yield* serviceAccounts.get({ id: identity.id })
      if (record.status !== "active") {
        return yield* Effect.fail(
          new IdentityInactive({ identityId: identity.id })
        )
      }
      return identity
    }
  )

  const provision = Effect.fn("@company/Authentication.provision")(function* (
    subject: AuthenticatedSubject
  ) {
    if (subject.kind === undefined) {
      return yield* Effect.fail(
        new IdentityProvisioningRequired({ reason: "kind" })
      )
    }

    return yield* database.transaction(() =>
      Effect.gen(function* () {
        const concurrent = yield* bindings.find(subject.issuer, subject.subject)
        if (concurrent !== undefined) return yield* requireActive(concurrent)

        const identity = yield* subject.kind === "user"
          ? Effect.gen(function* () {
              if (subject.email === undefined) {
                return yield* Effect.fail(
                  new IdentityProvisioningRequired({ reason: "email" })
                )
              }
              const email = yield* Effect.try({
                try: () => EmailAddress(subject.email!.trim().toLowerCase()),
                catch: () =>
                  new IdentityProvisioningRequired({ reason: "email" }),
              })
              const user = yield* users.provision({
                email,
                name: subject.name?.trim() || email,
              })
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

        const role =
          config.provisioningRole === "administrator"
            ? PLATFORM_ADMIN_ROLE_ID
            : config.provisioningRole === "operator"
              ? PLATFORM_OPERATOR_ROLE_ID
              : undefined
        if (role !== undefined) {
          yield* roleAssignments.create({
            parent: PLATFORM_ID,
            principal: identity.id,
            role,
          })
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
    subject: AuthenticatedSubject
  ) {
    const existing = yield* bindings.find(subject.issuer, subject.subject)
    return existing === undefined
      ? yield* provision(subject)
      : yield* requireActive(existing).pipe(
          Effect.provideService(CurrentInvocation, systemInvocation)
        )
  })

  const identify = Effect.fn("@company/Authentication.identify")(function* (
    headers: Headers
  ) {
    const subject = yield* provider.identify(headers)
    if (subject === null) return anonymousCaller
    return identityCaller((yield* resolve(subject)).id)
  })

  const invocation = Effect.fn("@company/Authentication.invocation")(function* (
    headers: Headers
  ) {
    const subject = yield* provider.identify(headers)
    if (subject === null) return anonymousInvocation
    return yield* authenticatedInvocation((yield* resolve(subject)).id)
  })

  const currentUser = Effect.fn("@company/Authentication.currentUser")(
    function* (headers: Headers) {
      const subject = yield* provider.identify(headers)
      if (subject === null) return null
      const identity = yield* resolve(subject)
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

/** Resolves verified external subjects into governed local actor invocations. */
export class Authentication extends Context.Service<Authentication>()(
  "@company/Authentication",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
