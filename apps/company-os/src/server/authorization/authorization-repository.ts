import type { IdentityId, PrincipalId } from "@company/model"
import { and, arrayOverlaps, eq, inArray, or, sql } from "drizzle-orm"
import { Context, Effect, Layer } from "effect"

import { Database } from "@/server/database/database"
import {
  groupMemberships,
  objects,
  roleAssignments,
  roles,
} from "@/server/database/schema"

const make = Effect.gen(function* () {
  const database = yield* Database

  const getTargets = Effect.fn("@company/AuthorizationRepository.getTargets")(
    function* (ids: ReadonlyArray<string>) {
      if (ids.length === 0) return []
      return yield* database
        .select({
          ancestorIds: objects.ancestorIds,
          id: objects.id,
          objectType: objects.objectType,
          systemManaged: objects.systemManaged,
        })
        .from(objects)
        .where(inArray(objects.id, ids))
    }
  )

  const listGrants = Effect.fn("@company/AuthorizationRepository.listGrants")(
    function* (input: {
      readonly directPrincipalIds: ReadonlyArray<PrincipalId>
      readonly groupMemberId?: IdentityId | undefined
      readonly permissions: ReadonlyArray<string>
      readonly scopeIds?: ReadonlyArray<string> | undefined
    }) {
      if (input.permissions.length === 0 || input.scopeIds?.length === 0)
        return []
      const scopeCondition =
        input.scopeIds === undefined
          ? undefined
          : inArray(roleAssignments.parentId, input.scopeIds)
      const principalCondition =
        input.groupMemberId === undefined
          ? inArray(roleAssignments.principalId, input.directPrincipalIds)
          : or(
              inArray(roleAssignments.principalId, input.directPrincipalIds),
              inArray(
                roleAssignments.principalId,
                database
                  .select({ id: groupMemberships.parentId })
                  .from(groupMemberships)
                  .where(eq(groupMemberships.memberId, input.groupMemberId))
              )
            )
      const rows = yield* database
        .selectDistinct({
          permissions: sql<ReadonlyArray<string>>`${roles.permissions}`,
          scopeId: sql<string>`${roleAssignments.parentId}`,
        })
        .from(roleAssignments)
        .innerJoin(roles, eq(roleAssignments.roleId, roles.id))
        .innerJoin(objects, eq(roleAssignments.parentId, objects.id))
        .where(
          and(
            principalCondition,
            eq(roles.scopeType, objects.objectType),
            arrayOverlaps(roles.permissions, input.permissions),
            scopeCondition
          )
        )
        .orderBy(roleAssignments.parentId)
      return rows
    }
  )

  return { getTargets, listGrants }
})

/** Optimized, read-only projection over the model's authorization objects. */
export class AuthorizationRepository extends Context.Service<AuthorizationRepository>()(
  "@company/AuthorizationRepository",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
