import type { IdentityId } from "@company/model"
import { and, arrayContains, eq, inArray, or, sql } from "drizzle-orm"
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

  const listScopeIdsWithPermission = Effect.fn(
    "@company/AuthorizationRepository.listScopeIdsWithPermission"
  )(function* (input: {
    readonly actorId: IdentityId
    readonly permission: string
    readonly scopeIds?: ReadonlyArray<string>
  }) {
    if (input.scopeIds?.length === 0) return []
    const scopeCondition =
      input.scopeIds === undefined
        ? undefined
        : inArray(roleAssignments.parentId, input.scopeIds)
    const groupIds = database
      .select({ id: groupMemberships.parentId })
      .from(groupMemberships)
      .where(eq(groupMemberships.memberId, input.actorId))
    const rows = yield* database
      .selectDistinct({
        scopeId: sql<string>`${roleAssignments.parentId}`,
      })
      .from(roleAssignments)
      .innerJoin(roles, eq(roleAssignments.roleId, roles.id))
      .innerJoin(objects, eq(roleAssignments.parentId, objects.id))
      .where(
        and(
          or(
            eq(roleAssignments.principalId, input.actorId),
            inArray(roleAssignments.principalId, groupIds)
          ),
          eq(roles.scopeType, objects.objectType),
          arrayContains(roles.permissions, [input.permission]),
          scopeCondition
        )
      )
      .orderBy(roleAssignments.parentId)
    return rows.map(({ scopeId }) => scopeId)
  })

  return { getTargets, listScopeIdsWithPermission }
})

/** Optimized, read-only projection over the model's authorization objects. */
export class AuthorizationRepository extends Context.Service<AuthorizationRepository>()(
  "@company/AuthorizationRepository",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
