import { Model } from "@company/model"
import type { ObjectCreateInput } from "@company/runtime"
import { Context, Data, Effect, Layer } from "effect"

import { modelPermissions } from "@/server/authorization/permission-catalog"
import { Database } from "@/server/database/database"
import { PLATFORM_ADMIN_ROLE_ID, PLATFORM_ID } from "@/system-records"

import { makeObjectService } from "./object-service"
import { RoleAssignmentRepository } from "./role-assignment-repository"
import { RoleRepository } from "./role-repository"

export class RoleScopeMismatch extends Data.TaggedError("RoleScopeMismatch")<{
  readonly actualScopeType: string
  readonly expectedScopeType: string
  readonly roleId: string
}> {}

class InvalidRolePermission extends Data.TaggedError("InvalidRolePermission")<{
  readonly permission: string
  readonly roleId: string
}> {}

export class LastPlatformAdministrator extends Data.TaggedError(
  "LastPlatformAdministrator"
)<{}> {}

const make = Effect.gen(function* () {
  const database = yield* Database
  const repository = yield* RoleAssignmentRepository
  const roleRepository = yield* RoleRepository
  const base = yield* makeObjectService(
    Model.objects.roleAssignment,
    repository
  )
  const permissions = new Set(modelPermissions)

  const create = Effect.fn("@company/RoleAssignmentService.create")(function* (
    input: ObjectCreateInput<(typeof Model.objects)["roleAssignment"]>
  ) {
    return yield* database.transaction(() =>
      Effect.gen(function* () {
        const assignment = yield* base.create(input)
        const role = yield* roleRepository.get(assignment.role)
        const scopeObjectType = yield* repository.getScopeObjectType(
          assignment.parent
        )
        if (scopeObjectType === undefined) {
          return yield* Effect.die(
            `Role assignment '${assignment.id}' has no active scope.`
          )
        }
        if (role.scopeType !== scopeObjectType) {
          return yield* Effect.fail(
            new RoleScopeMismatch({
              actualScopeType: scopeObjectType,
              expectedScopeType: role.scopeType,
              roleId: role.id,
            })
          )
        }
        const invalidPermission = role.permissions.find(
          (permission) => !permissions.has(permission)
        )
        if (invalidPermission !== undefined) {
          return yield* Effect.fail(
            new InvalidRolePermission({
              permission: invalidPermission,
              roleId: role.id,
            })
          )
        }
        return assignment
      })
    )
  })

  const deleteAssignment = Effect.fn("@company/RoleAssignmentService.delete")(
    function* (input: Parameters<typeof base.delete>[0]) {
      return yield* database.transaction(() =>
        Effect.gen(function* () {
          const assignment = yield* base.get(input)
          if (
            assignment.parent === PLATFORM_ID &&
            assignment.role === PLATFORM_ADMIN_ROLE_ID &&
            (yield* repository.lockRoleAssignments({
              roleId: PLATFORM_ADMIN_ROLE_ID,
              scopeId: PLATFORM_ID,
            })).length === 1
          ) {
            return yield* Effect.fail(new LastPlatformAdministrator())
          }
          return yield* base.delete(input)
        })
      )
    }
  )

  return { ...base, create, delete: deleteAssignment }
})

export class RoleAssignmentService extends Context.Service<RoleAssignmentService>()(
  "@company/RoleAssignmentService",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
