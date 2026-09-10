import { Context, Data, Effect, Layer } from "effect"

import { ServiceAccountService } from "#/runtime/access/server/service-account-service.ts"
import { UserService } from "#/runtime/access/server/user-service.ts"
import type { AuthenticatedUser } from "#/runtime/contract/authenticated-user.ts"
import { EmailAddress, RecordId } from "#/runtime/model/index.ts"
import { SYSTEM_SERVICE_ACCOUNT_ID } from "#/runtime/model/system-records.ts"
import {
  IdentityBindingRepository,
  type BoundIdentity,
} from "#/runtime/server/auth/identity-binding-repository.ts"
import {
  IdentityProvider,
  InvalidIdentityAssertion,
  type AuthenticatedSubject,
} from "#/runtime/server/auth/identity-provider.ts"
import {
  ReservedSystemActor,
  authenticatedInvocation,
  systemInvocation,
} from "#/runtime/server/invocation-context.ts"
import { CurrentInvocation } from "#/runtime/server/invocation.ts"
import { Database } from "#/runtime/server/storage/database.ts"

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

  const reconcileIdentity = Effect.fn(
    "@company/Authentication.reconcileIdentity"
  )(function* (identity: BoundIdentity, subject: AuthenticatedSubject) {
    if (identity.kind !== subject.kind)
      return yield* Effect.fail(
        new InvalidIdentityAssertion({
          reason: "The identity kind does not match its existing binding.",
        })
      )
    if (identity.kind === "user") {
      const record = yield* users.get({ id: identity.id })
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
      yield* serviceAccounts.reconcile({
        id: identity.id,
        name: subject.name?.trim() || record.name,
      })
    }
    return identity
  })

  const provision = Effect.fn("@company/Authentication.provision")(function* (
    subject: AuthenticatedSubject
  ) {
    return yield* database.transaction(() =>
      Effect.gen(function* () {
        const concurrent = yield* bindings.find(subject.issuer, subject.subject)
        if (concurrent !== undefined)
          return yield* reconcileIdentity(concurrent, subject)

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
                ...(subject.preferredIdentityId === undefined
                  ? {}
                  : {
                      id: RecordId("serviceAccount")(
                        subject.preferredIdentityId
                      ),
                    }),
                description: `Provisioned from ${subject.issuer}.`,
                name: subject.name?.trim() || subject.subject,
              })
              .pipe(
                Effect.map((account) => ({
                  id: account.id,
                  kind: "serviceAccount" as const,
                }))
              )

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
    if (subject.preferredIdentityId === SYSTEM_SERVICE_ACCOUNT_ID)
      return yield* Effect.fail(
        new ReservedSystemActor({ actorId: SYSTEM_SERVICE_ACCOUNT_ID })
      )
    const existing = yield* bindings.find(subject.issuer, subject.subject)
    if (existing?.id === SYSTEM_SERVICE_ACCOUNT_ID)
      return yield* Effect.fail(
        new ReservedSystemActor({ actorId: SYSTEM_SERVICE_ACCOUNT_ID })
      )
    return existing === undefined
      ? yield* provision(subject)
      : yield* reconcileIdentity(existing, subject).pipe(
          Effect.provideService(CurrentInvocation, systemInvocation)
        )
  })

  const resolveRequest = (headers: Headers) =>
    Effect.gen(function* () {
      const verified = yield* provider.identify(headers)
      return verified === null ? null : yield* resolve(verified)
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

  const invocation = Effect.fn("@company/Authentication.invocation")(function* (
    headers: Headers
  ) {
    const resolved = yield* requestIdentity(headers)
    if (resolved === null)
      return yield* Effect.fail(
        new InvalidIdentityAssertion({ reason: "Project access is required." })
      )
    return yield* authenticatedInvocation(resolved.id)
  })

  const currentUser = Effect.fn("@company/Authentication.currentUser")(
    function* (headers: Headers) {
      const resolved = yield* requestIdentity(headers)
      if (resolved === null) return null
      if (resolved.kind !== "user") {
        return yield* Effect.fail(new UserInterfaceRequired())
      }
      const user = yield* users
        .get({ id: resolved.id })
        .pipe(Effect.provideService(CurrentInvocation, systemInvocation))
      return {
        email: user.email,
        id: user.id,
        name: user.name,
      } satisfies AuthenticatedUser
    }
  )

  return { currentUser, invocation }
})

/** Maps verified provider identities to local attribution identities after project admission. */
export class Authentication extends Context.Service<Authentication>()(
  "@company/Authentication",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
