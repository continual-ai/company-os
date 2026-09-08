import { Etag } from "@company/runtime/model"
import {
  ALL_AUTHENTICATED_CALLERS_PRINCIPAL_SET_ID,
  ALL_CALLERS_PRINCIPAL_SET_ID,
  ANONYMOUS_ACTOR_ID,
  ADMINISTRATOR_ROLE_ID,
  ROOT_ID,
  SYSTEM_SERVICE_ACCOUNT_ID,
  SYSTEM_ROLE_ASSIGNMENT_ID,
} from "@company/runtime/model/system-records"
import { Database } from "@company/runtime/server/database/database"
import {
  authenticatedInvocation,
  ReservedSystemActor,
} from "@company/runtime/server/invocation-context"
import { assignments, insertValues } from "@company/runtime/server/postgres"
import {
  tableProjection,
  type TableRow,
  projection,
  type SelectionRow,
  inValues,
} from "@company/runtime/server/postgres"
import { Effect } from "effect"
import { describe, expect } from "vitest"

import {
  actors,
  anonymousActors,
  objects,
  principalSets,
  recordAliases,
  roleAssignments,
  roles,
} from "#/examples/schema.server.ts"
import { itDatabase } from "#/server/database/it-database.ts"
import { seedSystem } from "#/server/seeds/seed-system.ts"

describe("Company OS seeds", () => {
  itDatabase(
    "ensures stable system-managed records without aliases",
    Effect.fn(function* () {
      const result = yield* Effect.gen(function* () {
        const database = yield* Database
        const sql = database.sql

        const auditConstraints = yield* sql`select
                conname as "constraintName",
                condeferrable as "deferrable",
                condeferred as "initiallyDeferred"

          from pg_constraint

          where conname in (
                'objects_created_by_id_interface_actor_id_fkey',
                'objects_updated_by_id_interface_actor_id_fkey'
              )

          order by conname`

        yield* seedSystem()
        yield* sql`update ${roles} set ${assignments(sql, roles, { name: "Drifted", permissions: [] })}
          where ${roles.columns.id} = ${ADMINISTRATOR_ROLE_ID}`
        yield* sql`update ${objects} set ${assignments(sql, objects, { systemManaged: false })}
          where ${objects.columns.id} = ${ADMINISTRATOR_ROLE_ID}`
        yield* sql`delete
          from ${objects}
          where ${objects.columns.id} = ${SYSTEM_ROLE_ASSIGNMENT_ID}`

        yield* seedSystem()

        const seededObjectsFields = {
          id: objects.columns.id,
          systemManaged: objects.columns.systemManaged,
        }
        const seededObjects = yield* sql<
          SelectionRow<typeof seededObjectsFields>
        >`select ${projection(seededObjectsFields)}
          from ${objects}
          where ${inValues(sql, objects.columns.id, [
            ROOT_ID,
            SYSTEM_SERVICE_ACCOUNT_ID,
            ANONYMOUS_ACTOR_ID,
            ADMINISTRATOR_ROLE_ID,
            SYSTEM_ROLE_ASSIGNMENT_ID,
          ])}`
        const roleFields = {
          name: roles.columns.name,
          permissions: roles.columns.permissions,
        }
        const role = yield* sql<
          SelectionRow<typeof roleFields>
        >`select ${projection(roleFields)}
          from ${roles}
          where ${roles.columns.id} = ${ADMINISTRATOR_ROLE_ID}
          limit ${1}`
        const callerSetsFields = {
          id: principalSets.columns.id,
          kind: principalSets.columns.kind,
        }
        const callerSets = yield* sql<
          SelectionRow<typeof callerSetsFields>
        >`select ${projection(callerSetsFields)}
          from ${principalSets}
          order by ${sql.csv([principalSets.columns.id])}`
        const anonymousActorFields = {
          actorId: actors.columns.id,
          id: anonymousActors.columns.id,
        }
        const anonymousActor = yield* sql<
          SelectionRow<typeof anonymousActorFields>
        >`select ${projection(anonymousActorFields)}
          from ${anonymousActors}
          inner join ${actors} on ${actors.columns.id} = ${anonymousActors.columns.id}
          where ${anonymousActors.columns.id} = ${ANONYMOUS_ACTOR_ID}
          limit ${1}`
        const assignmentFields = {
          principalId: roleAssignments.columns.principalId,
          roleId: roleAssignments.columns.roleId,
        }
        const assignment = yield* sql<
          SelectionRow<typeof assignmentFields>
        >`select ${projection(assignmentFields)}
          from ${roleAssignments}
          where ${roleAssignments.columns.id} = ${SYSTEM_ROLE_ASSIGNMENT_ID}
          limit ${1}`
        const aliases = yield* sql<
          TableRow<typeof recordAliases>
        >`select ${tableProjection(recordAliases)}
          from ${recordAliases}`
        const impersonation = yield* authenticatedInvocation(
          SYSTEM_SERVICE_ACCOUNT_ID
        ).pipe(Effect.flip)
        const unknownActor = yield* sql`insert into ${objects} ${insertValues(
          sql,
          objects,
          {
            ancestorIds: [ROOT_ID],
            metadata: {},
            createdAt: "2026-08-24T00:00:00.000Z",
            createdById: "identity_missing",
            etag: Etag("invalid-actor"),
            id: "company_invalid_actor",
            objectType: "company",
            parentId: ROOT_ID,
            systemManaged: false,
            updatedAt: "2026-08-24T00:00:00.000Z",
            updatedById: SYSTEM_SERVICE_ACCOUNT_ID,
          }
        )}`.pipe(Effect.flip)

        return {
          aliases,
          anonymousActor,
          assignment,
          auditConstraints,
          callerSets,
          impersonation,
          role,
          seededObjects,
          unknownActor,
        }
      })

      expect(result.seededObjects.map(({ id }) => id)).toEqual(
        expect.arrayContaining([
          ROOT_ID,
          SYSTEM_SERVICE_ACCOUNT_ID,
          ANONYMOUS_ACTOR_ID,
          ADMINISTRATOR_ROLE_ID,
          SYSTEM_ROLE_ASSIGNMENT_ID,
        ])
      )
      expect(result.seededObjects).toHaveLength(5)
      expect(result.anonymousActor).toEqual([
        { actorId: ANONYMOUS_ACTOR_ID, id: ANONYMOUS_ACTOR_ID },
      ])
      expect(result.auditConstraints).toEqual([
        {
          constraintName: "objects_created_by_id_interface_actor_id_fkey",
          deferrable: true,
          initiallyDeferred: true,
        },
        {
          constraintName: "objects_updated_by_id_interface_actor_id_fkey",
          deferrable: true,
          initiallyDeferred: true,
        },
      ])
      expect(
        result.seededObjects.every(({ systemManaged }) => systemManaged)
      ).toBe(true)
      expect(result.role[0]?.name).toBe("Administrator")
      expect(result.callerSets).toEqual([
        {
          id: ALL_AUTHENTICATED_CALLERS_PRINCIPAL_SET_ID,
          kind: "allAuthenticatedCallers",
        },
        { id: ALL_CALLERS_PRINCIPAL_SET_ID, kind: "allCallers" },
      ])
      expect(Array.isArray(result.role[0]?.permissions)).toBe(true)
      expect(result.assignment[0]).toEqual({
        principalId: SYSTEM_SERVICE_ACCOUNT_ID,
        roleId: ADMINISTRATOR_ROLE_ID,
      })
      expect(result.aliases).toEqual([])
      expect(result.impersonation).toBeInstanceOf(ReservedSystemActor)
      expect(result.unknownActor).toBeDefined()
    }),
    10_000
  )
})
