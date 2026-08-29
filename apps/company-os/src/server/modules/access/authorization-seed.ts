import { Model } from "@company/model"
import { modelMetadata } from "@company/model/metadata"
import type { ObjectInsert } from "@company/runtime/effect/object-repository"
import { Effect } from "effect"

import {
  definedPermissions,
  operatorPermissions,
} from "@/server/authorization/permission-catalog"
import { makeObjectSeedRepository } from "@/server/database/object-repository"
import { currentActorId } from "@/server/invocation-context"
import {
  ALL_AUTHENTICATED_CALLERS_PRINCIPAL_SET_ID,
  ALL_CALLERS_PRINCIPAL_SET_ID,
  ANONYMOUS_ACTOR_ID,
  ADMINISTRATOR_ROLE_ID,
  OPERATOR_ROLE_ID,
  ROOT_ID,
  SYSTEM_ROLE_ASSIGNMENT_ID,
  SYSTEM_SERVICE_ACCOUNT_ID,
} from "@/system-records"

/** Converges required authorization records through repositories. */
export const seedAuthorization = Effect.fn("@company/seedAuthorization")(
  function* () {
    const actorId = yield* currentActorId
    const anonymousActorRepository = yield* makeObjectSeedRepository(
      Model.objects.anonymousActor
    )
    const serviceAccountRepository = yield* makeObjectSeedRepository(
      Model.objects.serviceAccount
    )
    const roleRepository = yield* makeObjectSeedRepository(Model.objects.role)
    const principalSetRepository = yield* makeObjectSeedRepository(
      Model.objects.principalSet
    )
    const roleAssignmentRepository = yield* makeObjectSeedRepository(
      Model.objects.roleAssignment
    )

    const systemServiceAccount = {
      aliases: [],
      metadata: {},
      createdBy: actorId,
      description: `Built-in system identity for ${modelMetadata.name}.`,
      id: SYSTEM_SERVICE_ACCOUNT_ID,
      name: "System",
      parent: ROOT_ID,
      status: "active",
      systemManaged: true,
      updatedBy: actorId,
    } satisfies ObjectInsert<(typeof Model.objects)["serviceAccount"]>
    yield* serviceAccountRepository.upsert(systemServiceAccount)

    yield* anonymousActorRepository.upsert({
      aliases: [],
      metadata: {},
      createdBy: actorId,
      id: ANONYMOUS_ACTOR_ID,
      name: "Anonymous",
      parent: ROOT_ID,
      systemManaged: true,
      updatedBy: actorId,
    })

    yield* principalSetRepository.upsert({
      aliases: [],
      metadata: {},
      createdBy: actorId,
      description: "Every caller, including callers without credentials.",
      id: ALL_CALLERS_PRINCIPAL_SET_ID,
      kind: "allCallers",
      name: "All callers",
      parent: ROOT_ID,
      systemManaged: true,
      updatedBy: actorId,
    })
    yield* principalSetRepository.upsert({
      aliases: [],
      metadata: {},
      createdBy: actorId,
      description:
        "Every caller with credentials accepted by the configured authentication boundary.",
      id: ALL_AUTHENTICATED_CALLERS_PRINCIPAL_SET_ID,
      kind: "allAuthenticatedCallers",
      name: "All authenticated callers",
      parent: ROOT_ID,
      systemManaged: true,
      updatedBy: actorId,
    })

    const systemAdministrator = {
      aliases: [],
      metadata: {},
      createdBy: actorId,
      description: `Full administration of ${modelMetadata.name}.`,
      id: ADMINISTRATOR_ROLE_ID,
      name: "Administrator",
      parent: ROOT_ID,
      permissions: definedPermissions,
      scopeType: "root",
      systemManaged: true,
      updatedBy: actorId,
    } satisfies ObjectInsert<(typeof Model.objects)["role"]>
    yield* roleRepository.upsert(systemAdministrator)

    const operator = {
      aliases: [],
      metadata: {},
      createdBy: actorId,
      description:
        "Create and manage sales records without administering identities or access.",
      id: OPERATOR_ROLE_ID,
      name: "Operator",
      parent: ROOT_ID,
      permissions: operatorPermissions,
      scopeType: "root",
      systemManaged: true,
      updatedBy: actorId,
    } satisfies ObjectInsert<(typeof Model.objects)["role"]>
    yield* roleRepository.upsert(operator)

    const systemAdministratorAssignment = {
      aliases: [],
      metadata: {},
      createdBy: actorId,
      id: SYSTEM_ROLE_ASSIGNMENT_ID,
      parent: ROOT_ID,
      principal: SYSTEM_SERVICE_ACCOUNT_ID,
      role: ADMINISTRATOR_ROLE_ID,
      systemManaged: true,
      updatedBy: actorId,
    } satisfies ObjectInsert<(typeof Model.objects)["roleAssignment"]>
    yield* roleAssignmentRepository.upsert(systemAdministratorAssignment)
  }
)
