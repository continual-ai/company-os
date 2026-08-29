import { Etag } from "@company/runtime"
import { eq, inArray, sql } from "drizzle-orm"
import { Effect } from "effect"
import { describe, expect } from "vitest"

import { Database } from "@/server/database/database"
import { itDatabase } from "@/server/database/it-database"
import {
  actors,
  anonymousActors,
  objects,
  principalSets,
  recordAliases,
  roleAssignments,
  roles,
} from "@/server/database/schema"
import {
  authenticatedInvocation,
  ReservedSystemActor,
} from "@/server/invocation-context"
import {
  ALL_AUTHENTICATED_CALLERS_PRINCIPAL_SET_ID,
  ALL_CALLERS_PRINCIPAL_SET_ID,
  ANONYMOUS_ACTOR_ID,
  ADMINISTRATOR_ROLE_ID,
  ROOT_ID,
  SYSTEM_SERVICE_ACCOUNT_ID,
  SYSTEM_ROLE_ASSIGNMENT_ID,
} from "@/system-records"

import { seedSystem } from "./seed-system"

describe("Company OS seeds", () => {
  itDatabase(
    "converges stable system-managed records without aliases",
    Effect.fn(function* () {
      const result = yield* Effect.gen(function* () {
        const database = yield* Database

        const auditConstraints = yield* database.execute<{
          constraintName: string
          deferrable: boolean
          initiallyDeferred: boolean
        }>(
          sql`select
                conname as "constraintName",
                condeferrable as "deferrable",
                condeferred as "initiallyDeferred"
              from pg_constraint
              where conname in (
                'objects_created_by_id_interface_actor_id_fkey',
                'objects_updated_by_id_interface_actor_id_fkey'
              )
              order by conname`,
          "objects"
        )

        yield* seedSystem()
        yield* database
          .update(roles)
          .set({ name: "Drifted", permissions: [] })
          .where(eq(roles.id, ADMINISTRATOR_ROLE_ID))
        yield* database
          .update(objects)
          .set({ systemManaged: false })
          .where(eq(objects.id, ADMINISTRATOR_ROLE_ID))
        yield* database
          .delete(objects)
          .where(eq(objects.id, SYSTEM_ROLE_ASSIGNMENT_ID))

        yield* seedSystem()

        const seededObjects = yield* database
          .select({ id: objects.id, systemManaged: objects.systemManaged })
          .from(objects)
          .where(
            inArray(objects.id, [
              ROOT_ID,
              SYSTEM_SERVICE_ACCOUNT_ID,
              ANONYMOUS_ACTOR_ID,
              ADMINISTRATOR_ROLE_ID,
              SYSTEM_ROLE_ASSIGNMENT_ID,
            ])
          )
        const role = yield* database
          .select({ name: roles.name, permissions: roles.permissions })
          .from(roles)
          .where(eq(roles.id, ADMINISTRATOR_ROLE_ID))
          .limit(1)
        const callerSets = yield* database
          .select({ id: principalSets.id, kind: principalSets.kind })
          .from(principalSets)
          .orderBy(principalSets.id)
        const anonymousActor = yield* database
          .select({ actorId: actors.id, id: anonymousActors.id })
          .from(anonymousActors)
          .innerJoin(actors, eq(actors.id, anonymousActors.id))
          .where(eq(anonymousActors.id, ANONYMOUS_ACTOR_ID))
          .limit(1)
        const assignment = yield* database
          .select({
            principalId: roleAssignments.principalId,
            roleId: roleAssignments.roleId,
          })
          .from(roleAssignments)
          .where(eq(roleAssignments.id, SYSTEM_ROLE_ASSIGNMENT_ID))
          .limit(1)
        const aliases = yield* database.select().from(recordAliases)
        const impersonation = yield* authenticatedInvocation(
          SYSTEM_SERVICE_ACCOUNT_ID
        ).pipe(Effect.flip)
        const unknownActor = yield* database
          .insert(objects)
          .values({
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
          })
          .pipe(Effect.flip)

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
