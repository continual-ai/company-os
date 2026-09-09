import { Context, Data, Effect, Layer } from "effect"

import { RoleAssignment, Role } from "#/runtime/access/model/index.ts"
import { RoleAssignmentRepository } from "#/runtime/access/server/role-assignment-repository.ts"
import type { ObjectCreateInput } from "#/runtime/model/index.ts"
import {
  ADMINISTRATOR_ROLE_ID,
  OPERATOR_ROLE_ID,
  ROOT_ID,
} from "#/runtime/model/system-records.ts"
import { Database } from "#/runtime/server/database/database.ts"
import { ModelContext } from "#/runtime/server/model-context.ts"
import { ObjectRepositories } from "#/runtime/server/model/object-repositories.ts"
import { makeObjectService } from "#/runtime/server/model/object-service.ts"

export class RoleScopeMismatch extends Data.TaggedError("RoleScopeMismatch")<{
  readonly actualScopeType: string
  readonly expectedScopeType: string
  readonly roleId: string
}> {}

class InvalidRolePermission extends Data.TaggedError("InvalidRolePermission")<{
  readonly permission: string
  readonly roleId: string
}> {}

export class LastAdministrator extends Data.TaggedError(
  "LastAdministrator"
)<{}> {}

const make = Effect.gen(function* () {
  const {
    capabilities: { isCapabilityPermission },
  } = yield* ModelContext
  const database = yield* Database
  const repository = yield* RoleAssignmentRepository
  const roleRepository = (yield* ObjectRepositories).get(Role)
  const base = yield* makeObjectService(RoleAssignment, repository)

  const create = Effect.fn("@company/RoleAssignmentService.create")(function* (
    input: ObjectCreateInput<typeof RoleAssignment>
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
          (permission) => !isCapabilityPermission(permission)
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
            assignment.parent === ROOT_ID &&
            assignment.role === ADMINISTRATOR_ROLE_ID &&
            (yield* repository.lockRoleAssignments({
              roleId: ADMINISTRATOR_ROLE_ID,
              scopeId: ROOT_ID,
            })).length === 1
          ) {
            return yield* Effect.fail(new LastAdministrator())
          }
          return yield* base.delete(input)
        })
      )
    }
  )

  const provisionInitialUserRole = Effect.fn(
    "@company/RoleAssignmentService.provisionInitialUserRole"
  )(function* (
    principal: ObjectCreateInput<typeof RoleAssignment>["principal"],
    initialRole: "administrator" | "operator" | "none"
  ) {
    if (initialRole === "none") return undefined
    return yield* database.transaction(() =>
      Effect.gen(function* () {
        const administrators = yield* repository.lockRoleAssignments({
          roleId: ADMINISTRATOR_ROLE_ID,
          scopeId: ROOT_ID,
        })
        if (initialRole === "administrator" && administrators.length !== 1)
          return undefined
        return yield* create({
          parent: ROOT_ID,
          principal,
          role:
            initialRole === "administrator"
              ? ADMINISTRATOR_ROLE_ID
              : OPERATOR_ROLE_ID,
        })
      })
    )
  })

  return { ...base, create, delete: deleteAssignment, provisionInitialUserRole }
})

export class RoleAssignmentService extends Context.Service<RoleAssignmentService>()(
  "@company/RoleAssignmentService",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
