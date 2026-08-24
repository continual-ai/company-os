import { fileURLToPath } from "node:url"

import { Etag } from "@continual/runtime"
import { PgliteClient } from "@effect/sql-pglite"
import { eq, inArray, sql } from "drizzle-orm"
import * as PgliteDrizzle from "drizzle-orm/effect-pglite"
import { migrate } from "drizzle-orm/effect-pglite/migrator"
import { Effect } from "effect"
import { describe, expect, it } from "vitest"

import {
  PLATFORM_ADMIN_ROLE_ID,
  PLATFORM_ID,
  SYSTEM_SERVICE_ACCOUNT_ID,
  SYSTEM_ROLE_ASSIGNMENT_ID,
} from "@/server/authorization/well-known-authorization.server"
import { Database } from "@/server/database/database.server"
import {
  objects,
  recordAliases,
  relations,
  roleAssignments,
  roles,
} from "@/server/database/schema.server"
import {
  authenticatedInvocation,
  ReservedSystemActor,
} from "@/server/invocation-context.server"

import { seedCompanyOs } from "./seed-company-os.server"

const migrationsFolder = fileURLToPath(
  new URL("../database/migrations", import.meta.url)
)
const TestDatabase = PgliteClient.layer()

function asDatabase(
  database: Effect.Success<
    ReturnType<typeof PgliteDrizzle.makeWithDefaults<typeof relations>>
  >
): typeof Database.Service {
  // SAFETY: the Effect PostgreSQL and PGlite drivers implement the same
  // Drizzle query and transaction API; only the client is replaced in tests.
  // oxlint-disable-next-line anti-slop/no-chained-type-assertions, typescript/no-unsafe-type-assertion
  return database as unknown as typeof Database.Service
}

function run<A, E>(effect: Effect.Effect<A, E, PgliteClient.PgliteClient>) {
  return Effect.runPromise(
    Effect.scoped(effect.pipe(Effect.provide(TestDatabase)))
  )
}

describe("Company OS seeds", () => {
  it("converges stable system-managed records without aliases", async () => {
    const result = await run(
      Effect.gen(function* () {
        const pglite = yield* PgliteDrizzle.makeWithDefaults({ relations })
        yield* migrate(pglite, { migrationsFolder })
        const database = asDatabase(pglite)

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
                'objects_created_by_id_interface_identity_id_fkey',
                'objects_updated_by_id_interface_identity_id_fkey'
              )
              order by conname`,
          "objects"
        )

        yield* seedCompanyOs().pipe(Effect.provideService(Database, database))
        yield* database
          .update(roles)
          .set({ name: "Drifted", permissions: [] })
          .where(eq(roles.id, PLATFORM_ADMIN_ROLE_ID))
        yield* database
          .update(objects)
          .set({ systemManaged: false })
          .where(eq(objects.id, PLATFORM_ADMIN_ROLE_ID))
        yield* database
          .delete(objects)
          .where(eq(objects.id, SYSTEM_ROLE_ASSIGNMENT_ID))

        yield* seedCompanyOs().pipe(Effect.provideService(Database, database))

        const seededObjects = yield* database
          .select({ id: objects.id, systemManaged: objects.systemManaged })
          .from(objects)
          .where(
            inArray(objects.id, [
              PLATFORM_ID,
              SYSTEM_SERVICE_ACCOUNT_ID,
              PLATFORM_ADMIN_ROLE_ID,
              SYSTEM_ROLE_ASSIGNMENT_ID,
            ])
          )
        const role = yield* database
          .select({ name: roles.name, permissions: roles.permissions })
          .from(roles)
          .where(eq(roles.id, PLATFORM_ADMIN_ROLE_ID))
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
            ancestorIds: [PLATFORM_ID],
            metadata: {},
            createdAt: "2026-08-24T00:00:00.000Z",
            createdById: "identity_missing",
            etag: Etag("invalid-actor"),
            id: "company_invalid_actor",
            objectType: "company",
            parentId: PLATFORM_ID,
            systemManaged: false,
            updatedAt: "2026-08-24T00:00:00.000Z",
            updatedById: SYSTEM_SERVICE_ACCOUNT_ID,
          })
          .pipe(Effect.flip)

        return {
          aliases,
          assignment,
          auditConstraints,
          impersonation,
          role,
          seededObjects,
          unknownActor,
        }
      })
    )

    expect(result.seededObjects.map(({ id }) => id)).toEqual(
      expect.arrayContaining([
        PLATFORM_ID,
        SYSTEM_SERVICE_ACCOUNT_ID,
        PLATFORM_ADMIN_ROLE_ID,
        SYSTEM_ROLE_ASSIGNMENT_ID,
      ])
    )
    expect(result.seededObjects).toHaveLength(4)
    expect(result.auditConstraints).toEqual([
      {
        constraintName: "objects_created_by_id_interface_identity_id_fkey",
        deferrable: true,
        initiallyDeferred: true,
      },
      {
        constraintName: "objects_updated_by_id_interface_identity_id_fkey",
        deferrable: true,
        initiallyDeferred: true,
      },
    ])
    expect(
      result.seededObjects.every(({ systemManaged }) => systemManaged)
    ).toBe(true)
    expect(result.role[0]?.name).toBe("Platform administrator")
    expect(Array.isArray(result.role[0]?.permissions)).toBe(true)
    expect(result.assignment[0]).toEqual({
      principalId: SYSTEM_SERVICE_ACCOUNT_ID,
      roleId: PLATFORM_ADMIN_ROLE_ID,
    })
    expect(result.aliases).toEqual([])
    expect(result.impersonation).toBeInstanceOf(ReservedSystemActor)
    expect(result.unknownActor).toBeDefined()
  })
})
