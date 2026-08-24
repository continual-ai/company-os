import { AcmeModel } from "@acme/api"
import type { ObjectInsert } from "@continual/runtime/effect/object-repository"
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

/** Converges Acme's source-owned authorization records through repositories. */
export const seedAuthorization = Effect.fn("@acme/seedAuthorization")(
  function* () {
    const actorId = yield* currentActorId
    const serviceAccountRepository = yield* makeObjectRepository(
      AcmeModel.objects.serviceAccount
    )
    const roleRepository = yield* makeObjectRepository(AcmeModel.objects.role)
    const roleAssignmentRepository = yield* makeObjectRepository(
      AcmeModel.objects.roleAssignment
    )

    const systemServiceAccount = {
      aliases: [],
      metadata: {},
      createdBy: actorId,
      description: "Acme's built-in system identity.",
      id: SYSTEM_SERVICE_ACCOUNT_ID,
      name: "Company OS",
      parent: PLATFORM_ID,
      systemManaged: true,
      updatedBy: actorId,
    } satisfies ObjectInsert<(typeof AcmeModel.objects)["serviceAccount"]>
    yield* serviceAccountRepository.upsert(systemServiceAccount)

    const platformAdministrator = {
      aliases: [],
      metadata: {},
      createdBy: actorId,
      description: "Full administration of Acme's Company OS.",
      id: PLATFORM_ADMIN_ROLE_ID,
      name: "Platform administrator",
      parent: PLATFORM_ID,
      permissions: modelPermissions,
      scopeType: "platform",
      systemManaged: true,
      updatedBy: actorId,
    } satisfies ObjectInsert<(typeof AcmeModel.objects)["role"]>
    yield* roleRepository.upsert(platformAdministrator)

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
    } satisfies ObjectInsert<(typeof AcmeModel.objects)["roleAssignment"]>
    yield* roleAssignmentRepository.upsert(systemAdministratorAssignment)
  }
)
