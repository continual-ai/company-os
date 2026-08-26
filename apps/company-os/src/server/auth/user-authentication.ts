import {
  EmailAddress,
  Timestamp,
  type RecordId,
  type RecordIdentifier,
} from "@company/runtime"
import { CurrentInvocation } from "@company/runtime/effect/object-service"
import { Context, Data, Effect, Layer } from "effect"

import type { AuthenticatedUser } from "@/authentication"
import { Authorization } from "@/server/authorization/authorization-service"
import {
  anonymousCaller,
  authenticatedCaller,
  identityCaller,
} from "@/server/caller"
import { Database } from "@/server/database/database"
import { systemInvocation } from "@/server/invocation-context"
import { InvitationInvalid } from "@/server/objects/invitation-errors"
import { InvitationRepository } from "@/server/objects/invitation-repository"
import { RecordIdentifierResolver } from "@/server/objects/record-identifier-resolver"
import { RoleAssignmentRepository } from "@/server/objects/role-assignment-repository"
import { RoleAssignmentService } from "@/server/objects/role-assignment-service"
import { UserService } from "@/server/objects/user-service"
import { PLATFORM_ADMIN_ROLE_ID, PLATFORM_ID } from "@/system-records"

import { AuthSettings } from "./auth-config"
import { AuthProtocol, type AuthUser } from "./auth-protocol"
import { IdentityBindingRepository } from "./identity-binding-repository"
import { secretMatches } from "./secret-token"

class FirstUserRejected extends Data.TaggedError("FirstUserRejected")<{}> {}

class InvitationRequired extends Data.TaggedError("InvitationRequired")<{}> {}

class InvalidSession extends Data.TaggedError("InvalidSession")<{}> {}

class UserSuspended extends Data.TaggedError("UserSuspended")<{}> {}

const make = Effect.gen(function* () {
  const config = yield* AuthSettings
  const auth = yield* AuthProtocol
  const authorization = yield* Authorization
  const database = yield* Database
  const repository = yield* IdentityBindingRepository
  const roleAssignments = yield* RoleAssignmentService
  const roleAssignmentRepository = yield* RoleAssignmentRepository
  const users = yield* UserService
  const invitations = yield* InvitationRepository
  const identifiers = yield* RecordIdentifierResolver

  const getAuthenticatedUser = Effect.fn(
    "@company/UserAuthentication.getAuthenticatedUser"
  )(function* (userId: RecordId<"user">) {
    const user = yield* users.get({ id: userId })
    if (user.status === "suspended") {
      return yield* Effect.fail(new UserSuspended())
    }
    return {
      email: user.email,
      id: user.id,
      name: user.name,
    } satisfies AuthenticatedUser
  })

  const requireAuthUser = Effect.fn(
    "@company/UserAuthentication.requireAuthUser"
  )(function* (headers: Headers) {
    const authUser = yield* auth.session(headers)
    if (authUser === null) return yield* Effect.fail(new InvalidSession())
    return authUser
  })

  const resolveUser = Effect.fn("@company/UserAuthentication.resolveUser")(
    function* (authUser: AuthUser) {
      return yield* Effect.gen(function* () {
        const existingUserId = yield* repository.findUserId(authUser.authUserId)
        if (existingUserId !== undefined) {
          return yield* getAuthenticatedUser(existingUserId)
        }

        return yield* database.transaction(() =>
          Effect.gen(function* () {
            if (yield* repository.hasUserPlatformAdministrator()) {
              return yield* Effect.fail(new InvitationRequired())
            }

            const email = EmailAddress(authUser.email.trim().toLowerCase())
            if (
              !authUser.emailVerified ||
              (config.bootstrapEmail !== undefined &&
                email !== config.bootstrapEmail)
            ) {
              return yield* Effect.fail(new FirstUserRejected())
            }

            const user = yield* users.provision({
              email,
              name: authUser.name.trim() || email,
            })
            yield* roleAssignments.create({
              parent: PLATFORM_ID,
              principal: user.id,
              role: PLATFORM_ADMIN_ROLE_ID,
            })
            yield* repository.bind(authUser.authUserId, user.id)

            return {
              email,
              id: user.id,
              name: user.name,
            } satisfies AuthenticatedUser
          })
        )
      }).pipe(Effect.provideService(CurrentInvocation, systemInvocation))
    }
  )

  const identify = Effect.fn("@company/UserAuthentication.identify")(function* (
    headers: Headers
  ) {
    const authUser = yield* auth.session(headers)
    if (authUser === null) return anonymousCaller
    const userId = yield* repository.findUserId(authUser.authUserId)
    if (userId === undefined) return authenticatedCaller
    const user = yield* getAuthenticatedUser(userId).pipe(
      Effect.provideService(CurrentInvocation, systemInvocation)
    )
    return identityCaller(user.id)
  })

  const authenticate = Effect.fn("@company/UserAuthentication.authenticate")(
    function* (headers: Headers) {
      return yield* resolveUser(yield* requireAuthUser(headers))
    }
  )

  const acceptInvitation = Effect.fn(
    "@company/UserAuthentication.acceptInvitation"
  )(function* (
    headers: Headers,
    identifier: RecordIdentifier<"invitation">,
    redemptionToken: string
  ) {
    const authUser = yield* requireAuthUser(headers)
    return yield* database.transaction(() =>
      Effect.gen(function* () {
        const invitationId = yield* identifiers.resolve(
          "invitation",
          identifier
        )
        yield* authorization.requireActionFor(authenticatedCaller, {
          actionId: "accept",
          objectType: "invitation",
          recordIds: [invitationId],
        })
        const credential = yield* invitations.lockCredential(invitationId)
        if (
          credential === undefined ||
          credential.consumedAt !== null ||
          !secretMatches(redemptionToken, credential.secretHash)
        ) {
          return yield* Effect.fail(new InvitationInvalid({ reason: "token" }))
        }

        const invitation = yield* invitations.get(invitationId)
        if (invitation.status === "accepted") {
          return yield* Effect.fail(
            new InvitationInvalid({ reason: "accepted" })
          )
        }
        if (invitation.status === "revoked") {
          return yield* Effect.fail(
            new InvitationInvalid({ reason: "revoked" })
          )
        }
        if (Date.parse(invitation.expiresAt) <= Date.now()) {
          return yield* Effect.fail(
            new InvitationInvalid({ reason: "expired" })
          )
        }
        if (!authUser.emailVerified) {
          return yield* Effect.fail(
            new InvitationInvalid({ reason: "unverifiedEmail" })
          )
        }
        const email = EmailAddress(authUser.email.trim().toLowerCase())
        if (email !== invitation.email) {
          return yield* Effect.fail(
            new InvitationInvalid({ reason: "emailMismatch" })
          )
        }

        const existingUserId = yield* repository.findUserId(authUser.authUserId)
        const user =
          existingUserId === undefined
            ? yield* users.provision({
                email,
                name: authUser.name.trim() || email,
              })
            : yield* users.get({ id: existingUserId })
        if (existingUserId === undefined) {
          yield* repository.bind(authUser.authUserId, user.id)
        }
        const existingAssignment =
          yield* roleAssignmentRepository.findAssignment({
            principalId: user.id,
            roleId: invitation.role,
            scopeId: invitation.parent,
          })
        if (existingAssignment === undefined) {
          yield* roleAssignments.create({
            parent: invitation.parent,
            principal: user.id,
            role: invitation.role,
          })
        }

        const acceptedAt = Timestamp(new Date().toISOString())
        const accepted = yield* invitations.update({
          acceptedAt,
          acceptedBy: user.id,
          etag: invitation.etag,
          id: invitationId,
          status: "accepted",
          updatedBy: systemInvocation.actorId,
        })
        yield* invitations.consumeCredential(invitationId, new Date(acceptedAt))
        return { invitation: accepted, user: user.id }
      }).pipe(Effect.provideService(CurrentInvocation, systemInvocation))
    )
  })

  return { acceptInvitation, authenticate, identify }
})

/** Authenticates browser sessions and resolves them to canonical User identities. */
export class UserAuthentication extends Context.Service<UserAuthentication>()(
  "@company/UserAuthentication",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
