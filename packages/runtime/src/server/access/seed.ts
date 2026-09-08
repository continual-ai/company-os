import { Effect } from "effect"

import {
  RoleAssignment,
  ServiceAccount,
  Role,
  PrincipalSet,
  AnonymousActor,
} from "#/model/access/model.ts"
import {
  ALL_AUTHENTICATED_CALLERS_PRINCIPAL_SET_ID,
  ALL_CALLERS_PRINCIPAL_SET_ID,
  ANONYMOUS_ACTOR_ID,
  ADMINISTRATOR_ROLE_ID,
  OPERATOR_ROLE_ID,
  ROOT_ID,
  SYSTEM_ROLE_ASSIGNMENT_ID,
  SYSTEM_SERVICE_ACCOUNT_ID,
} from "#/model/system-records.ts"
import { createPermissionCatalog } from "#/server/authorization/permission-catalog.ts"
import { makeObjectSeedRepository } from "#/server/database/object-repository.ts"
import { currentActorId } from "#/server/invocation-context.ts"
import { ModelContext } from "#/server/model-context.ts"
import type { ObjectInsert } from "#/server/object-repository.ts"

/** Converges required authorization records through repositories. */
export const seedAuthorization = Effect.fn("@company/seedAuthorization")(
  function* (operatorPermissions: ReadonlyArray<string> = []) {
    const { model } = yield* ModelContext
    const { definedPermissions } = createPermissionCatalog(model)
    const actorId = yield* currentActorId
    const anonymousActorRepository =
      yield* makeObjectSeedRepository(AnonymousActor)
    const serviceAccountRepository =
      yield* makeObjectSeedRepository(ServiceAccount)
    const roleRepository = yield* makeObjectSeedRepository(Role)
    const principalSetRepository = yield* makeObjectSeedRepository(PrincipalSet)
    const roleAssignmentRepository =
      yield* makeObjectSeedRepository(RoleAssignment)

    const systemServiceAccount = {
      aliases: [],
      metadata: {},
      createdBy: actorId,
      description: `Built-in system identity for ${model.name}.`,
      id: SYSTEM_SERVICE_ACCOUNT_ID,
      name: "System",
      parent: ROOT_ID,
      status: "active",
      systemManaged: true,
      updatedBy: actorId,
    } satisfies ObjectInsert<typeof ServiceAccount>
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
      description: "Everyone, including visitors who are not signed in.",
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
      description: "All authenticated users and service accounts.",
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
      description: `Full administration of ${model.name}.`,
      id: ADMINISTRATOR_ROLE_ID,
      name: "Administrator",
      parent: ROOT_ID,
      permissions: definedPermissions,
      scopeType: "root",
      systemManaged: true,
      updatedBy: actorId,
    } satisfies ObjectInsert<typeof Role>
    yield* roleRepository.upsert(systemAdministrator)

    const operator = {
      aliases: [],
      metadata: {},
      createdBy: actorId,
      description:
        "Manage business records and files without administering identities or access.",
      id: OPERATOR_ROLE_ID,
      name: "Operator",
      parent: ROOT_ID,
      permissions: operatorPermissions,
      scopeType: "root",
      systemManaged: true,
      updatedBy: actorId,
    } satisfies ObjectInsert<typeof Role>
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
    } satisfies ObjectInsert<typeof RoleAssignment>
    yield* roleAssignmentRepository.upsert(systemAdministratorAssignment)
  }
)
