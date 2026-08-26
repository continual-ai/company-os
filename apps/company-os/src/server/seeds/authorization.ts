import { Model } from "@company/model"
import { modelMetadata } from "@company/model/metadata"
import type { ObjectInsert } from "@company/runtime/effect/object-repository"
import { Effect } from "effect"

import {
  modelPermissions,
  operatorPermissions,
} from "@/server/authorization/permission-catalog"
import { makeObjectRepository } from "@/server/database/object-repository"
import { currentActorId } from "@/server/invocation-context"
import {
  ALL_AUTHENTICATED_CALLERS_PRINCIPAL_SET_ID,
  ALL_CALLERS_PRINCIPAL_SET_ID,
  ANONYMOUS_ACTOR_ID,
  PLATFORM_ADMIN_ROLE_ID,
  PLATFORM_ID,
  PLATFORM_OPERATOR_ROLE_ID,
  SYSTEM_ROLE_ASSIGNMENT_ID,
  SYSTEM_SERVICE_ACCOUNT_ID,
} from "@/system-records"

/** Converges source-owned authorization records through repositories. */
export const seedAuthorization = Effect.fn("@company/seedAuthorization")(
  function* () {
    const actorId = yield* currentActorId
    const anonymousActorRepository = yield* makeObjectRepository(
      Model.objects.anonymousActor
    )
    const serviceAccountRepository = yield* makeObjectRepository(
      Model.objects.serviceAccount
    )
    const roleRepository = yield* makeObjectRepository(Model.objects.role)
    const principalSetRepository = yield* makeObjectRepository(
      Model.objects.principalSet
    )
    const roleAssignmentRepository = yield* makeObjectRepository(
      Model.objects.roleAssignment
    )

    const systemServiceAccount = {
      aliases: [],
      metadata: {},
      createdBy: actorId,
      description: `Built-in system identity for ${modelMetadata.name}.`,
      id: SYSTEM_SERVICE_ACCOUNT_ID,
      name: "System",
      parent: PLATFORM_ID,
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
      parent: PLATFORM_ID,
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
      parent: PLATFORM_ID,
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
      parent: PLATFORM_ID,
      systemManaged: true,
      updatedBy: actorId,
    })

    const systemAdministrator = {
      aliases: [],
      metadata: {},
      createdBy: actorId,
      description: `Full administration of ${modelMetadata.name}.`,
      id: PLATFORM_ADMIN_ROLE_ID,
      name: "Platform administrator",
      parent: PLATFORM_ID,
      permissions: modelPermissions,
      scopeType: "platform",
      systemManaged: true,
      updatedBy: actorId,
    } satisfies ObjectInsert<(typeof Model.objects)["role"]>
    yield* roleRepository.upsert(systemAdministrator)

    const operator = {
      aliases: [],
      metadata: {},
      createdBy: actorId,
      description:
        "Create and manage CRM records without administering identities or access.",
      id: PLATFORM_OPERATOR_ROLE_ID,
      name: "Operator",
      parent: PLATFORM_ID,
      permissions: operatorPermissions,
      scopeType: "platform",
      systemManaged: true,
      updatedBy: actorId,
    } satisfies ObjectInsert<(typeof Model.objects)["role"]>
    yield* roleRepository.upsert(operator)

    const systemAdministratorAssignment = {
      aliases: [],
      metadata: {},
      createdBy: actorId,
      id: SYSTEM_ROLE_ASSIGNMENT_ID,
      parent: PLATFORM_ID,
      principal: SYSTEM_SERVICE_ACCOUNT_ID,
      role: PLATFORM_ADMIN_ROLE_ID,
      systemManaged: true,
      updatedBy: actorId,
    } satisfies ObjectInsert<(typeof Model.objects)["roleAssignment"]>
    yield* roleAssignmentRepository.upsert(systemAdministratorAssignment)
  }
)
