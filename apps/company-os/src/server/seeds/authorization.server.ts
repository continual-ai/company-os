import { Model } from "@company/model"
import { modelMetadata } from "@company/model/metadata"
import type { ObjectInsert } from "@company/runtime/effect/object-repository"
import { Effect } from "effect"

import { modelPermissions } from "@/server/authorization/permission-catalog.server"
import {
  PLATFORM_ADMIN_ROLE_ID,
  PLATFORM_ID,
  SYSTEM_ROLE_ASSIGNMENT_ID,
  SYSTEM_SERVICE_ACCOUNT_ID,
} from "@/server/authorization/well-known-authorization.server"
import { makeObjectRepository } from "@/server/database/model-storage.server"
import { currentActorId } from "@/server/invocation-context.server"

/** Converges source-owned authorization records through repositories. */
export const seedAuthorization = Effect.fn("@company/seedAuthorization")(
  function* () {
    const actorId = yield* currentActorId
    const serviceAccountRepository = yield* makeObjectRepository(
      Model.objects.serviceAccount
    )
    const roleRepository = yield* makeObjectRepository(Model.objects.role)
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
      systemManaged: true,
      updatedBy: actorId,
    } satisfies ObjectInsert<(typeof Model.objects)["serviceAccount"]>
    yield* serviceAccountRepository.upsert(systemServiceAccount)

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
