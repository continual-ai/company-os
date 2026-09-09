import { Context, Effect, Layer } from "effect"

import { RoleAssignment } from "#/runtime/access/model/index.ts"
import { ModelContext } from "#/runtime/server/model-context.ts"
import { ObjectRepositories } from "#/runtime/server/model/object-repositories.ts"
import { Database } from "#/runtime/server/storage/database.ts"
import {
  projection,
  type SelectionRow,
} from "#/runtime/server/storage/index.ts"

const make = Effect.gen(function* () {
  const context = yield* ModelContext
  const objects = context.storage.core.objects
  const roleAssignments = context.table(RoleAssignment)
  const database = yield* Database
  const sql = database.sql
  const base = (yield* ObjectRepositories).get(RoleAssignment)

  const getScopeObjectType = Effect.fn(
    "@company/RoleAssignmentRepository.getScopeObjectType"
  )(function* (scopeId: string) {
    const rowsFields = { objectType: objects.columns.objectType }
    const rows = yield* sql<
      SelectionRow<typeof rowsFields>
    >`select ${projection(rowsFields)}
          from ${objects}
          where ${objects.columns.id} = ${scopeId}
          limit ${1}`
    return rows[0]?.objectType
  })

  const lockRoleAssignments = Effect.fn(
    "@company/RoleAssignmentRepository.lockRoleAssignments"
  )(function* (input: { readonly roleId: string; readonly scopeId: string }) {
    const selection = { id: roleAssignments.columns.id }
    return yield* sql<
      SelectionRow<typeof selection>
    >`select ${projection(selection)}
          from ${roleAssignments}
          where (${roleAssignments.columns.parentId} = ${input.scopeId} and ${roleAssignments.columns.roleId} = ${input.roleId})
          order by ${sql.csv([roleAssignments.columns.id])} for update`
  })

  const findAssignment = Effect.fn(
    "@company/RoleAssignmentRepository.findAssignment"
  )(function* (input: {
    readonly principalId: string
    readonly roleId: string
    readonly scopeId: string
  }) {
    const rowsFields2 = { id: roleAssignments.columns.id }
    const rows = yield* sql<
      SelectionRow<typeof rowsFields2>
    >`select ${projection(rowsFields2)}
          from ${roleAssignments}
          where (${roleAssignments.columns.parentId} = ${input.scopeId} and ${roleAssignments.columns.principalId} = ${input.principalId} and ${roleAssignments.columns.roleId} = ${input.roleId})
          limit ${1}`
    return rows[0]
  })

  return {
    ...base,
    findAssignment,
    getScopeObjectType,
    lockRoleAssignments,
  }
})

export class RoleAssignmentRepository extends Context.Service<RoleAssignmentRepository>()(
  "@company/RoleAssignmentRepository",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
