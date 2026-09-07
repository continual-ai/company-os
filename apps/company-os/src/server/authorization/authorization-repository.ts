import { projection, type SelectionRow, inValues } from "@company/postgres"
import type { IdentityId, PrincipalId } from "company-os/model"
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
  const sql = database.sql

  const getTargets = Effect.fn("@company/AuthorizationRepository.getTargets")(
    function* (ids: ReadonlyArray<string>) {
      if (ids.length === 0) return []
      const selection = {
        ancestorIds: objects.columns.ancestorIds,
        id: objects.columns.id,
        objectType: objects.columns.objectType,
        systemManaged: objects.columns.systemManaged,
      }
      return yield* sql<
        SelectionRow<typeof selection>
      >`select ${projection(selection)}
          from ${objects}
          where ${inValues(sql, objects.columns.id, ids)}`
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
          : inValues(sql, roleAssignments.columns.parentId, input.scopeIds)
      const direct = inValues(
        sql,
        roleAssignments.columns.principalId,
        input.directPrincipalIds
      )
      const principalCondition =
        input.groupMemberId === undefined
          ? direct
          : sql`(${direct} or ${roleAssignments.columns.principalId} in (select ${groupMemberships.columns.parentId}
          from ${groupMemberships}
          where ${groupMemberships.columns.memberId} = ${input.groupMemberId}))`
      const condition = sql.and(
        [
          principalCondition,
          sql`${roles.columns.scopeType} = ${objects.columns.objectType}`,
          sql`${roles.columns.permissions} && ${input.permissions}::text[]`,
          scopeCondition,
        ].filter((part) => part !== undefined)
      )
      const rows = yield* sql<{
        permissions: ReadonlyArray<string>
        scopeId: string
      }>`
        select distinct ${roles.columns.permissions} as permissions, ${roleAssignments.columns.parentId} as "scopeId"

          from ${roleAssignments}
          inner join ${roles} on ${roleAssignments.columns.roleId} = ${roles.columns.id}

          inner join ${objects} on ${roleAssignments.columns.parentId} = ${objects.columns.id}

          where ${condition}
          order by ${roleAssignments.columns.parentId}`
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
