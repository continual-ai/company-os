import { AcmeModel } from "@acme/api"
import { Etag, Timestamp } from "@continual/runtime"
import type { ObjectInsert } from "@continual/runtime/effect/object-repository"
import { CurrentInvocation } from "@continual/runtime/effect/object-service"
import { Clock, Effect } from "effect"

import { modelPermissions } from "@/server/authorization/permission-catalog.server"
import {
  PLATFORM_ADMIN_ROLE_ID,
  PLATFORM_ID,
  SYSTEM_ROLE_ASSIGNMENT_ID,
  SYSTEM_SERVICE_ACCOUNT_ID,
} from "@/server/authorization/well-known-authorization.server"
import { makeObjectRepository } from "@/server/database/model-storage.server"

const AUTHORIZATION_SEED_ETAG = Etag("seed:authorization:v1")

/** Converges Acme's source-owned authorization records through repositories. */
export const seedAuthorization = Effect.fn("@acme/seedAuthorization")(
  function* () {
    const { actorId } = yield* CurrentInvocation
    const now = Timestamp(
      new Date(yield* Clock.currentTimeMillis).toISOString()
    )
    const serviceAccountRepository = yield* makeObjectRepository(
      AcmeModel.objects.serviceAccount
    )
    const roleRepository = yield* makeObjectRepository(AcmeModel.objects.role)
    const roleAssignmentRepository = yield* makeObjectRepository(
      AcmeModel.objects.roleAssignment
    )

    const systemServiceAccount = {
      aliases: [],
      annotations: {},
      createdAt: now,
      createdBy: actorId,
      description: "Acme's built-in system identity.",
      etag: AUTHORIZATION_SEED_ETAG,
      id: SYSTEM_SERVICE_ACCOUNT_ID,
      name: "Company OS",
      parent: PLATFORM_ID,
      systemManaged: true,
      updatedAt: now,
      updatedBy: actorId,
    } satisfies ObjectInsert<(typeof AcmeModel.objects)["serviceAccount"]>
    yield* serviceAccountRepository.upsert(systemServiceAccount)

    const platformAdministrator = {
      aliases: [],
      annotations: {},
      createdAt: now,
      createdBy: actorId,
      description: "Full administration of Acme's Company OS.",
      etag: AUTHORIZATION_SEED_ETAG,
      id: PLATFORM_ADMIN_ROLE_ID,
      name: "Platform administrator",
      parent: PLATFORM_ID,
      permissions: modelPermissions,
      scopeType: "platform",
      systemManaged: true,
      updatedAt: now,
      updatedBy: actorId,
    } satisfies ObjectInsert<(typeof AcmeModel.objects)["role"]>
    yield* roleRepository.upsert(platformAdministrator)

    const systemAdministratorAssignment = {
      aliases: [],
      annotations: {},
      createdAt: now,
      createdBy: actorId,
      etag: AUTHORIZATION_SEED_ETAG,
      id: SYSTEM_ROLE_ASSIGNMENT_ID,
      parent: PLATFORM_ID,
      principal: SYSTEM_SERVICE_ACCOUNT_ID,
      role: PLATFORM_ADMIN_ROLE_ID,
      systemManaged: true,
      updatedAt: now,
      updatedBy: actorId,
    } satisfies ObjectInsert<(typeof AcmeModel.objects)["roleAssignment"]>
    yield* roleAssignmentRepository.upsert(systemAdministratorAssignment)
  }
)
