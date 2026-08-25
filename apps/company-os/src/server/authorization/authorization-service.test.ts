import { fileURLToPath } from "node:url"

import { Model } from "@company/model"
import { Etag, RecordId, Timestamp } from "@company/runtime"
import { CurrentInvocation } from "@company/runtime/effect/object-service"
import { PgliteClient } from "@effect/sql-pglite"
import { eq } from "drizzle-orm"
import * as PgliteDrizzle from "drizzle-orm/effect-pglite"
import { migrate } from "drizzle-orm/effect-pglite/migrator"
import { Effect } from "effect"
import { describe, expect, it } from "vitest"

import { Database } from "@/server/database/database"
import {
  authorizationScopes,
  companies,
  groupMemberships,
  groups,
  identities,
  objects,
  parties,
  principals,
  relations,
  roleAssignments,
  roles,
  users,
} from "@/server/database/schema"
import {
  authenticatedInvocation,
  systemInvocation,
} from "@/server/invocation-context"
import { CompanyRepository } from "@/server/objects/company-repository"
import { makeObjectService } from "@/server/objects/object-service"
import { RoleAssignmentRepository } from "@/server/objects/role-assignment-repository"
import {
  LastPlatformAdministrator,
  RoleAssignmentService,
  RoleScopeMismatch,
} from "@/server/objects/role-assignment-service"
import { RoleRepository } from "@/server/objects/role-repository"
import { seedSystem } from "@/server/seeds/seed-system"
import {
  PLATFORM_ADMIN_ROLE_ID,
  PLATFORM_ID,
  SYSTEM_SERVICE_ACCOUNT_ID,
  SYSTEM_ROLE_ASSIGNMENT_ID,
} from "@/system-records"

import { AuthorizationRepository } from "./authorization-repository"
import {
  Authorization,
  AuthorizationTargetNotFound,
  PermissionDenied,
} from "./authorization-service"

const migrationsFolder = fileURLToPath(
  new URL("../database/migrations", import.meta.url)
)
const TestDatabase = PgliteClient.layer()
const now = Timestamp("2026-08-23T00:00:00.000Z")
const UserId = RecordId("user")
const CompanyId = RecordId("company")
const GroupId = RecordId("group")
const GroupMembershipId = RecordId("groupMembership")
const RoleId = RecordId("role")
const RoleAssignmentId = RecordId("roleAssignment")

type ObjectInsert = typeof objects.$inferInsert

function asDatabase(
  database: Effect.Success<
    ReturnType<typeof PgliteDrizzle.makeWithDefaults<typeof relations>>
  >
): typeof Database.Service {
  // SAFETY: Drizzle's Effect PostgreSQL and PGlite drivers implement the same
  // query and transaction API. Tests replace only the underlying client.
  // oxlint-disable-next-line anti-slop/no-chained-type-assertions, typescript/no-unsafe-type-assertion
  return database as unknown as typeof Database.Service
}

function objectRow(
  input: Pick<ObjectInsert, "ancestorIds" | "id" | "objectType" | "parentId">
): ObjectInsert {
  return {
    ...input,
    metadata: {},
    createdAt: now,
    createdById: SYSTEM_SERVICE_ACCOUNT_ID,
    etag: Etag(`etag_${input.id}`),
    systemManaged: false,
    updatedAt: now,
    updatedById: SYSTEM_SERVICE_ACCOUNT_ID,
  }
}

function run<A, E>(effect: Effect.Effect<A, E, PgliteClient.PgliteClient>) {
  return Effect.runPromise(
    Effect.scoped(effect.pipe(Effect.provide(TestDatabase)))
  )
}

describe("Authorization", () => {
  it("applies direct and group grants through the ownership hierarchy", async () => {
    const userId = UserId("user_00000000000000000000000001")
    const allowedCompanyId = CompanyId("company_00000000000000000000000001")
    const groupCompanyId = CompanyId("company_00000000000000000000000002")
    const readerRoleId = RoleId("role_00000000000000000000000001")
    const groupId = GroupId("group_00000000000000000000000001")
    const membershipId = GroupMembershipId(
      "groupMembership_00000000000000000000000001"
    )

    const result = await run(
      Effect.gen(function* () {
        const pglite = yield* PgliteDrizzle.makeWithDefaults({ relations })
        yield* migrate(pglite, { migrationsFolder })
        const database = asDatabase(pglite)
        yield* seedSystem().pipe(Effect.provideService(Database, database))

        yield* database.insert(objects).values([
          objectRow({
            ancestorIds: [PLATFORM_ID],
            id: userId,
            objectType: "user",
            parentId: PLATFORM_ID,
          }),
          objectRow({
            ancestorIds: [PLATFORM_ID],
            id: allowedCompanyId,
            objectType: "company",
            parentId: PLATFORM_ID,
          }),
          objectRow({
            ancestorIds: [PLATFORM_ID],
            id: groupCompanyId,
            objectType: "company",
            parentId: PLATFORM_ID,
          }),
          objectRow({
            ancestorIds: [PLATFORM_ID],
            id: readerRoleId,
            objectType: "role",
            parentId: PLATFORM_ID,
          }),
        ])
        yield* database.insert(users).values({
          email: "actor@example.com",
          id: userId,
          image: null,
          name: "Ada Lovelace",
          parentId: PLATFORM_ID,
        })
        yield* database.insert(identities).values({ id: userId })
        yield* database.insert(principals).values({ id: userId })
        yield* database.insert(companies).values([
          {
            domain: null,
            id: allowedCompanyId,
            industry: null,
            lifecycleStage: "prospect",
            logo: null,
            name: "Allowed",
            parentId: PLATFORM_ID,
            website: null,
          },
          {
            domain: null,
            id: groupCompanyId,
            industry: null,
            lifecycleStage: "prospect",
            logo: null,
            name: "Via group",
            parentId: PLATFORM_ID,
            website: null,
          },
        ])
        yield* database
          .insert(authorizationScopes)
          .values([{ id: allowedCompanyId }, { id: groupCompanyId }])
        yield* database.insert(parties).values([
          { id: allowedCompanyId, image: null, name: "Allowed" },
          { id: groupCompanyId, image: null, name: "Via group" },
        ])
        yield* database.insert(roles).values({
          description: null,
          id: readerRoleId,
          name: "Company reader",
          permissions: ["company.get", "company.list"],
          parentId: PLATFORM_ID,
          scopeType: "company",
        })

        const directAssignmentId = RoleAssignmentId(
          "roleAssignment_00000000000000000000000001"
        )
        yield* database.insert(objects).values(
          objectRow({
            ancestorIds: [allowedCompanyId, PLATFORM_ID],
            id: directAssignmentId,
            objectType: "roleAssignment",
            parentId: allowedCompanyId,
          })
        )
        yield* database.insert(roleAssignments).values({
          parentId: allowedCompanyId,
          id: directAssignmentId,
          principalId: userId,
          roleId: readerRoleId,
        })

        const authorizationRepository =
          yield* AuthorizationRepository.make.pipe(
            Effect.provideService(Database, database)
          )
        const authorization = yield* Authorization.make.pipe(
          Effect.provideService(
            AuthorizationRepository,
            authorizationRepository
          )
        )
        const companyRepository = yield* CompanyRepository.make.pipe(
          Effect.provideService(Database, database)
        )
        const companyService = yield* makeObjectService(
          Model.objects.company,
          companyRepository
        ).pipe(
          Effect.provideService(Authorization, authorization),
          Effect.provideService(Database, database)
        )
        const userContext = yield* authenticatedInvocation(userId)
        const asUser = <A, E>(effect: Effect.Effect<A, E, CurrentInvocation>) =>
          effect.pipe(Effect.provideService(CurrentInvocation, userContext))

        const directList = yield* asUser(companyService.list())
        const directGet = yield* asUser(
          companyService.get({ id: allowedCompanyId })
        )
        const hiddenGet = yield* asUser(
          companyService.get({ id: groupCompanyId }).pipe(Effect.flip)
        )
        const deniedUpdate = yield* asUser(
          companyService
            .update({ id: allowedCompanyId, name: "Not allowed" })
            .pipe(Effect.flip)
        )
        const deniedBatch = yield* asUser(
          companyService
            .batchGet({ ids: [allowedCompanyId, groupCompanyId] })
            .pipe(Effect.flip)
        )

        yield* database.insert(objects).values(
          objectRow({
            ancestorIds: [PLATFORM_ID],
            id: groupId,
            objectType: "group",
            parentId: PLATFORM_ID,
          })
        )
        yield* database.insert(groups).values({
          description: null,
          id: groupId,
          name: "Sales",
          parentId: PLATFORM_ID,
        })
        yield* database.insert(principals).values({ id: groupId })
        yield* database.insert(objects).values(
          objectRow({
            ancestorIds: [groupId, PLATFORM_ID],
            id: membershipId,
            objectType: "groupMembership",
            parentId: groupId,
          })
        )
        yield* database.insert(groupMemberships).values({
          parentId: groupId,
          id: membershipId,
          memberId: userId,
        })
        const groupAssignmentId = RoleAssignmentId(
          "roleAssignment_00000000000000000000000002"
        )
        yield* database.insert(objects).values(
          objectRow({
            ancestorIds: [groupCompanyId, PLATFORM_ID],
            id: groupAssignmentId,
            objectType: "roleAssignment",
            parentId: groupCompanyId,
          })
        )
        yield* database.insert(roleAssignments).values({
          parentId: groupCompanyId,
          id: groupAssignmentId,
          principalId: groupId,
          roleId: readerRoleId,
        })

        const groupList = yield* asUser(companyService.list())
        const allowedBatch = yield* asUser(
          companyService.batchGet({
            ids: [allowedCompanyId, groupCompanyId],
          })
        )

        yield* database.delete(objects).where(eq(objects.id, membershipId))
        const afterRevocation = yield* asUser(companyService.list())

        const systemList = yield* companyService
          .list()
          .pipe(Effect.provideService(CurrentInvocation, systemInvocation))

        const roleRepository = yield* RoleRepository.make.pipe(
          Effect.provideService(Database, database)
        )
        const roleAssignmentRepository =
          yield* RoleAssignmentRepository.make.pipe(
            Effect.provideService(Database, database)
          )
        const roleAssignmentService = yield* RoleAssignmentService.make.pipe(
          Effect.provideService(
            AuthorizationRepository,
            authorizationRepository
          ),
          Effect.provideService(Authorization, authorization),
          Effect.provideService(Database, database),
          Effect.provideService(
            RoleAssignmentRepository,
            roleAssignmentRepository
          ),
          Effect.provideService(RoleRepository, roleRepository)
        )
        const userAdministratorAssignmentId = RoleAssignmentId(
          "role_assignment_user_platform_admin"
        )
        yield* database.insert(objects).values(
          objectRow({
            ancestorIds: [PLATFORM_ID],
            id: userAdministratorAssignmentId,
            objectType: "roleAssignment",
            parentId: PLATFORM_ID,
          })
        )
        yield* database.insert(roleAssignments).values({
          parentId: PLATFORM_ID,
          id: userAdministratorAssignmentId,
          principalId: userId,
          roleId: PLATFORM_ADMIN_ROLE_ID,
        })
        const protectedSystemAssignment = yield* asUser(
          roleAssignmentService
            .delete({ id: SYSTEM_ROLE_ASSIGNMENT_ID })
            .pipe(Effect.flip)
        )
        yield* roleAssignmentService
          .delete({ id: userAdministratorAssignmentId })
          .pipe(Effect.provideService(CurrentInvocation, systemInvocation))
        const wrongScope = yield* roleAssignmentService
          .create({
            parent: PLATFORM_ID,
            principal: userId,
            role: readerRoleId,
          })
          .pipe(
            Effect.flip,
            Effect.provideService(CurrentInvocation, systemInvocation)
          )
        const lastAdministrator = yield* roleAssignmentService
          .delete({ id: SYSTEM_ROLE_ASSIGNMENT_ID })
          .pipe(
            Effect.flip,
            Effect.provideService(CurrentInvocation, systemInvocation)
          )
        yield* database
          .delete(objects)
          .where(eq(objects.id, SYSTEM_ROLE_ASSIGNMENT_ID))
        const systemAfterGrantRemoval = yield* companyService
          .list()
          .pipe(Effect.provideService(CurrentInvocation, systemInvocation))

        return {
          afterRevocation,
          allowedBatch,
          deniedBatch,
          deniedUpdate,
          directGet,
          directList,
          groupList,
          hiddenGet,
          lastAdministrator,
          protectedSystemAssignment,
          systemAfterGrantRemoval,
          systemList,
          wrongScope,
        }
      })
    )

    expect(result.directList.items.map(({ id }) => id)).toEqual([
      allowedCompanyId,
    ])
    expect(result.directGet.id).toBe(allowedCompanyId)
    expect(result.hiddenGet).toBeInstanceOf(AuthorizationTargetNotFound)
    expect(result.deniedUpdate).toBeInstanceOf(PermissionDenied)
    expect(result.deniedBatch).toBeInstanceOf(AuthorizationTargetNotFound)
    expect(result.groupList.items.map(({ id }) => id)).toEqual(
      expect.arrayContaining([allowedCompanyId, groupCompanyId])
    )
    expect(result.groupList.items).toHaveLength(2)
    expect(result.allowedBatch.items.map(({ id }) => id)).toEqual([
      allowedCompanyId,
      groupCompanyId,
    ])
    expect(result.afterRevocation.items.map(({ id }) => id)).toEqual([
      allowedCompanyId,
    ])
    expect(result.systemList.items.map(({ id }) => id)).toEqual(
      expect.arrayContaining([allowedCompanyId, groupCompanyId])
    )
    expect(result.systemList.items).toHaveLength(2)
    expect(result.systemAfterGrantRemoval.items).toEqual([])
    expect(result.wrongScope).toBeInstanceOf(RoleScopeMismatch)
    expect(result.protectedSystemAssignment).toBeInstanceOf(PermissionDenied)
    expect(result.lastAdministrator).toBeInstanceOf(LastPlatformAdministrator)
  })
})
