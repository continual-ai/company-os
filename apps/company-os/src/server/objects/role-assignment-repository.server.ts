import { Model } from "@company/model"
import { and, eq } from "drizzle-orm"
import { Context, Effect, Layer } from "effect"

import { Database } from "@/server/database/database.server"
import { makeObjectRepository } from "@/server/database/model-storage.server"
import { objects, roleAssignments } from "@/server/database/schema.server"

const make = Effect.gen(function* () {
  const database = yield* Database
  const base = yield* makeObjectRepository(Model.objects.roleAssignment)

  const getScopeObjectType = Effect.fn(
    "@company/RoleAssignmentRepository.getScopeObjectType"
  )(function* (scopeId: string) {
    const rows = yield* database
      .select({ objectType: objects.objectType })
      .from(objects)
      .where(eq(objects.id, scopeId))
      .limit(1)
    return rows[0]?.objectType
  })

  const lockRoleAssignments = Effect.fn(
    "@company/RoleAssignmentRepository.lockRoleAssignments"
  )(function* (input: { readonly roleId: string; readonly scopeId: string }) {
    return yield* database
      .select({ id: roleAssignments.id })
      .from(roleAssignments)
      .where(
        and(
          eq(roleAssignments.parentId, input.scopeId),
          eq(roleAssignments.roleId, input.roleId)
        )
      )
      .orderBy(roleAssignments.id)
      .for("update")
  })

  const findAssignment = Effect.fn(
    "@company/RoleAssignmentRepository.findAssignment"
  )(function* (input: {
    readonly principalId: string
    readonly roleId: string
    readonly scopeId: string
  }) {
    const rows = yield* database
      .select({ id: roleAssignments.id })
      .from(roleAssignments)
      .where(
        and(
          eq(roleAssignments.parentId, input.scopeId),
          eq(roleAssignments.principalId, input.principalId),
          eq(roleAssignments.roleId, input.roleId)
        )
      )
      .limit(1)
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
