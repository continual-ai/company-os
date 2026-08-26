import { Model } from "@company/model"
import {
  EmailAddress,
  RecordId,
  Timestamp,
  type ActionInput,
  type RecordIdentifier,
} from "@company/runtime"
import { toEffectInputSchema } from "@company/runtime/effect"
import { generateRecordId } from "@company/runtime/effect/object-service"
import { Context, Data, Effect, Layer, Schema } from "effect"

import { generateSecret, hashSecret } from "@/server/auth/secret-token"
import { Authorization } from "@/server/authorization/authorization-service"
import { Database } from "@/server/database/database"
import { currentActorId } from "@/server/invocation-context"

import { InvitationInvalid } from "./invitation-errors"
import { InvitationRepository } from "./invitation-repository"
import { makeObjectService } from "./object-service"
import { RecordIdentifierResolver } from "./record-identifier-resolver"
import { RoleAssignmentRepository } from "./role-assignment-repository"
import { RoleRepository } from "./role-repository"

const issueInputSchema = toEffectInputSchema(
  Model.actions.invitation.issue.input
)

class InvitationRoleScopeMismatch extends Data.TaggedError(
  "InvitationRoleScopeMismatch"
)<{
  readonly roleScopeType: string
  readonly scopeType: string
}> {}

function currentTimestamp(): Timestamp {
  return Timestamp(new Date().toISOString())
}

const make = Effect.gen(function* () {
  const authorization = yield* Authorization
  const database = yield* Database
  const identifiers = yield* RecordIdentifierResolver
  const repository = yield* InvitationRepository
  const roleAssignmentRepository = yield* RoleAssignmentRepository
  const roleRepository = yield* RoleRepository
  const base = yield* makeObjectService(Model.objects.invitation, repository)

  const issue = Effect.fn("@company/InvitationService.issue")(function* (
    input: ActionInput<(typeof Model.actions.invitation)["issue"]>
  ) {
    const decodedValue =
      yield* Schema.decodeUnknownEffect(issueInputSchema)(input)
    // SAFETY: issueInputSchema is compiled directly from this action's portable input.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const decoded = decodedValue as ActionInput<
      (typeof Model.actions.invitation)["issue"]
    >
    const roleId = yield* identifiers.resolve("role", decoded.role)
    const scopeValue = yield* identifiers.resolve(
      "authorizationScope",
      decoded.scope
    )

    return yield* database.transaction(() =>
      Effect.gen(function* () {
        const scopeType =
          yield* roleAssignmentRepository.getScopeObjectType(scopeValue)
        if (scopeType === undefined) {
          return yield* Effect.die(
            `Invitation scope '${scopeValue}' is missing.`
          )
        }
        // SAFETY: getScopeObjectType proves this canonical record implements AuthorizationScope.
        // oxlint-disable-next-line anti-slop/no-chained-type-assertions, typescript/no-unsafe-type-assertion
        const scopeId = scopeValue as unknown as Parameters<
          typeof repository.insert
        >[0]["parent"]

        yield* authorization.requireAction({
          actionId: "issue",
          objectType: "invitation",
          parentId: scopeId,
        })
        const role = yield* roleRepository.get(roleId)
        if (role.scopeType !== scopeType) {
          return yield* Effect.fail(
            new InvitationRoleScopeMismatch({
              roleScopeType: role.scopeType,
              scopeType,
            })
          )
        }
        if (Date.parse(decoded.expiresAt) <= Date.now()) {
          return yield* Effect.fail(
            new InvitationInvalid({ reason: "expired" })
          )
        }

        const actorId = yield* currentActorId
        const id = RecordId("invitation")(generateRecordId("invitation"))
        const redemptionToken = generateSecret()
        const invitation = yield* repository.insert({
          acceptedAt: null,
          aliases: [],
          createdBy: actorId,
          email: EmailAddress(decoded.email.trim().toLowerCase()),
          expiresAt: decoded.expiresAt,
          id,
          metadata: {},
          parent: scopeId,
          revokedAt: null,
          role: roleId,
          status: "pending",
          systemManaged: false,
          updatedBy: actorId,
        })
        yield* repository.insertCredential(id, hashSecret(redemptionToken))
        return { invitation: invitation.id, redemptionToken }
      })
    )
  })

  const revoke = Effect.fn("@company/InvitationService.revoke")(function* (
    identifier: RecordIdentifier<"invitation">
  ) {
    return yield* database.transaction(() =>
      Effect.gen(function* () {
        const id = yield* identifiers.resolve("invitation", identifier)
        yield* authorization.requireAction({
          actionId: "revoke",
          objectType: "invitation",
          recordIds: [id],
        })
        yield* repository.lockCredential(id)
        const invitation = yield* repository.get(id)
        if (invitation.status === "revoked") return invitation
        if (invitation.status === "accepted") {
          return yield* Effect.fail(
            new InvitationInvalid({ reason: "accepted" })
          )
        }
        const actorId = yield* currentActorId
        return yield* repository.update({
          etag: invitation.etag,
          id,
          revokedAt: currentTimestamp(),
          status: "revoked",
          updatedBy: actorId,
        })
      })
    )
  })

  return { ...base, issue, revoke }
})

export class InvitationService extends Context.Service<InvitationService>()(
  "@company/InvitationService",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
