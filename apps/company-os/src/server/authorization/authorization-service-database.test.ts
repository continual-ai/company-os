import type { TableRow } from "@company/postgres"
import { insertValues, assignments } from "@company/postgres"
import { Etag, RecordId, Timestamp } from "@company/runtime"
import { CurrentInvocation } from "@company/runtime/effect/object-service"
import { Model } from "company-os/model"
import { Effect, Layer } from "effect"
import { describe, expect } from "vitest"

import { RoleAssignmentRepository } from "@/modules/access/role-assignment/server/role-assignment-repository"
import {
  LastAdministrator,
  RoleAssignmentService,
  RoleScopeMismatch,
} from "@/modules/access/role-assignment/server/role-assignment-service"
import { anonymousCaller, authenticatedCaller } from "@/server/caller"
import { Database } from "@/server/database/database"
import { itDatabase } from "@/server/database/it-database"
import {
  authorizationScopes,
  companies,
  groupMemberships,
  groups,
  identities,
  objects,
  parties,
  principals,
  roleAssignments,
  roles,
  users,
} from "@/server/database/schema"
import {
  anonymousInvocation,
  authenticatedInvocation,
  currentActorId,
  systemInvocation,
} from "@/server/invocation-context"
import { Links } from "@/server/model/link-service"
import { ObjectRepositories } from "@/server/model/object-repositories"
import { makeObjectService } from "@/server/model/object-service"
import { RecordIdentifierResolver } from "@/server/model/record-identifier-resolver"
import { PageTokens } from "@/server/page-tokens"
import { seedSystem } from "@/server/seeds/seed-system"
import {
  ALL_CALLERS_PRINCIPAL_SET_ID,
  ADMINISTRATOR_ROLE_ID,
  ROOT_ID,
  SYSTEM_SERVICE_ACCOUNT_ID,
  SYSTEM_ROLE_ASSIGNMENT_ID,
} from "@/system-records"

import { AuthorizationRepository } from "./authorization-repository"
import {
  Authorization,
  AuthorizationTargetNotFound,
  PermissionDenied,
} from "./authorization-service"

const now = Timestamp("2026-08-23T00:00:00.000Z")
const UserId = RecordId("user")
const ServiceAccountId = RecordId("serviceAccount")
const CompanyId = RecordId("company")
const GroupId = RecordId("group")
const GroupMembershipId = RecordId("groupMembership")
const RoleId = RecordId("role")
const RoleAssignmentId = RecordId("roleAssignment")

type ObjectInsert = TableRow<typeof objects>

function objectRow(
  input: Pick<ObjectInsert, "ancestorIds" | "id" | "objectType" | "parentId">
): ObjectInsert {
  return {
    ...input,
    metadata: {},
    createdAt: now,
    createdById: SYSTEM_SERVICE_ACCOUNT_ID,
    etag: Etag("1"),
    systemManaged: false,
    updatedAt: now,
    updatedById: SYSTEM_SERVICE_ACCOUNT_ID,
  }
}

describe("Authorization", () => {
  itDatabase(
    "applies direct and group grants through the ownership hierarchy",
    Effect.fn(function* () {
      const userId = UserId("user_00000000000000000000000001")
      const allowedCompanyId = CompanyId("company_00000000000000000000000001")
      const groupCompanyId = CompanyId("company_00000000000000000000000002")
      const readerRoleId = RoleId("role_00000000000000000000000001")
      const groupId = GroupId("group_00000000000000000000000001")
      const membershipId = GroupMembershipId(
        "groupMembership_00000000000000000000000001"
      )

      const result = yield* Effect.gen(function* () {
        const database = yield* Database
        const sql = database.sql
        yield* seedSystem()
        const objectRepositories = yield* ObjectRepositories.make

        yield* sql`insert into ${objects} ${insertValues(sql, objects, [
          objectRow({
            ancestorIds: [ROOT_ID],
            id: userId,
            objectType: "user",
            parentId: ROOT_ID,
          }),
          objectRow({
            ancestorIds: [ROOT_ID],
            id: allowedCompanyId,
            objectType: "company",
            parentId: ROOT_ID,
          }),
          objectRow({
            ancestorIds: [ROOT_ID],
            id: groupCompanyId,
            objectType: "company",
            parentId: ROOT_ID,
          }),
          objectRow({
            ancestorIds: [ROOT_ID],
            id: readerRoleId,
            objectType: "role",
            parentId: ROOT_ID,
          }),
        ])}`
        yield* sql`insert into ${users} ${insertValues(sql, users, {
          email: "actor@example.com",
          id: userId,
          image: null,
          name: "Ada Lovelace",
          parentId: ROOT_ID,
        })}`
        yield* sql`insert into ${identities} ${insertValues(sql, identities, { id: userId })}`
        yield* sql`insert into ${principals} ${insertValues(sql, principals, { id: userId })}`
        yield* sql`insert into ${companies} ${insertValues(sql, companies, [
          {
            domain: null,
            id: allowedCompanyId,
            industry: null,
            lifecycleStage: "prospect",
            logo: null,
            name: "Allowed",
            parentId: ROOT_ID,
            website: null,
          },
          {
            domain: null,
            id: groupCompanyId,
            industry: null,
            lifecycleStage: "prospect",
            logo: null,
            name: "Via group",
            parentId: ROOT_ID,
            website: null,
          },
        ])}`
        yield* sql`insert into ${authorizationScopes} ${insertValues(sql, authorizationScopes, [{ id: allowedCompanyId }, { id: groupCompanyId }])}`
        yield* sql`insert into ${parties} ${insertValues(sql, parties, [
          { id: allowedCompanyId },
          { id: groupCompanyId },
        ])}`
        yield* sql`insert into ${roles} ${insertValues(sql, roles, {
          description: null,
          id: readerRoleId,
          name: "Company reader",
          permissions: ["company.get", "company.list"],
          parentId: ROOT_ID,
          scopeType: "company",
        })}`

        const directAssignmentId = RoleAssignmentId(
          "roleAssignment_00000000000000000000000001"
        )
        yield* sql`insert into ${objects} ${insertValues(
          sql,
          objects,
          objectRow({
            ancestorIds: [allowedCompanyId, ROOT_ID],
            id: directAssignmentId,
            objectType: "roleAssignment",
            parentId: allowedCompanyId,
          })
        )}`
        yield* sql`insert into ${roleAssignments} ${insertValues(
          sql,
          roleAssignments,
          {
            parentId: allowedCompanyId,
            id: directAssignmentId,
            principalId: userId,
            roleId: readerRoleId,
          }
        )}`

        const authorizationRepository = yield* AuthorizationRepository.make
        const authorization = yield* Authorization.make.pipe(
          Effect.provideService(
            AuthorizationRepository,
            authorizationRepository
          )
        )
        const anonymousAdmission = yield* authorization.checkCapabilitiesFor(
          anonymousCaller,
          [{ permission: "company.get", target: allowedCompanyId }]
        )
        const authenticatedAdmission =
          yield* authorization.checkCapabilitiesFor(authenticatedCaller, [
            { permission: "company.get", target: allowedCompanyId },
          ])
        const publicAdmissionAssignmentId = RoleAssignmentId(
          "role_assignment_public_admission_test"
        )
        yield* sql`insert into ${objects} ${insertValues(
          sql,
          objects,
          objectRow({
            ancestorIds: [ROOT_ID],
            id: publicAdmissionAssignmentId,
            objectType: "roleAssignment",
            parentId: ROOT_ID,
          })
        )}`
        yield* sql`insert into ${roleAssignments} ${insertValues(
          sql,
          roleAssignments,
          {
            id: publicAdmissionAssignmentId,
            parentId: ROOT_ID,
            principalId: ALL_CALLERS_PRINCIPAL_SET_ID,
            roleId: ADMINISTRATOR_ROLE_ID,
          }
        )}`
        const publicAdmission = yield* authorization.checkCapabilitiesFor(
          anonymousCaller,
          [{ permission: "company.get", target: allowedCompanyId }]
        )
        const publicAdmissionFromInvocation = yield* authorization
          .checkCapabilities([
            { permission: "company.get", target: allowedCompanyId },
          ])
          .pipe(Effect.provideService(CurrentInvocation, anonymousInvocation))
        yield* sql`delete
          from ${objects}
          where ${objects.columns.id} = ${publicAdmissionAssignmentId}`
        const companyRepository = objectRepositories.company
        const identifiers = yield* RecordIdentifierResolver.make
        const companyService = yield* makeObjectService(
          Model.objects.company,
          companyRepository
        ).pipe(
          Effect.provide(
            Links.layer.pipe(Layer.provide(ObjectRepositories.layer))
          ),
          Effect.provideService(Authorization, authorization),
          Effect.provideService(RecordIdentifierResolver, identifiers)
        )
        const userContext = yield* authenticatedInvocation(userId)
        const delegatedActorId = ServiceAccountId(
          "serviceAccount_0000000000000000000001"
        )
        const delegatedContext = yield* authenticatedInvocation(
          delegatedActorId,
          userId
        )
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
        const directCapabilities = yield* asUser(
          authorization.checkCapabilities([
            { permission: "company.list" },
            { permission: "company.get", target: allowedCompanyId },
            { permission: "company.update", target: allowedCompanyId },
            { permission: "company.get", target: groupCompanyId },
          ])
        )
        // List admission and row readability are separate: list-only never exposes records.
        yield* sql`update ${roles} set ${assignments(sql, roles, { permissions: ["company.list"] })}
          where ${roles.columns.id} = ${readerRoleId}`
        expect((yield* asUser(companyService.list())).items).toEqual([])
        expect(
          yield* asUser(
            companyService.get({ id: allowedCompanyId }).pipe(Effect.flip)
          )
        ).toMatchObject({ _tag: "AuthorizationTargetNotFound" })
        yield* sql`update ${roles} set ${assignments(sql, roles, { permissions: ["company.get"] })}
          where ${roles.columns.id} = ${readerRoleId}`
        expect(
          (yield* asUser(companyService.get({ id: allowedCompanyId }))).id
        ).toBe(allowedCompanyId)
        expect(
          yield* asUser(companyService.list().pipe(Effect.flip))
        ).toMatchObject({
          _tag: "PermissionDenied",
          permission: "company.list",
        })
        yield* sql`update ${roles} set ${assignments(sql, roles, { permissions: ["company.get", "company.list"] })}
          where ${roles.columns.id} = ${readerRoleId}`
        const delegatedCapabilities = yield* authorization
          .checkCapabilities([
            { permission: "company.get", target: allowedCompanyId },
          ])
          .pipe(Effect.provideService(CurrentInvocation, delegatedContext))
        const attributedActor = yield* currentActorId.pipe(
          Effect.provideService(CurrentInvocation, delegatedContext)
        )

        yield* sql`insert into ${objects} ${insertValues(
          sql,
          objects,
          objectRow({
            ancestorIds: [ROOT_ID],
            id: groupId,
            objectType: "group",
            parentId: ROOT_ID,
          })
        )}`
        yield* sql`insert into ${groups} ${insertValues(sql, groups, {
          description: null,
          id: groupId,
          name: "Sales",
          parentId: ROOT_ID,
        })}`
        yield* sql`insert into ${principals} ${insertValues(sql, principals, { id: groupId })}`
        yield* sql`insert into ${objects} ${insertValues(
          sql,
          objects,
          objectRow({
            ancestorIds: [groupId, ROOT_ID],
            id: membershipId,
            objectType: "groupMembership",
            parentId: groupId,
          })
        )}`
        yield* sql`insert into ${groupMemberships} ${insertValues(
          sql,
          groupMemberships,
          {
            parentId: groupId,
            id: membershipId,
            memberId: userId,
          }
        )}`
        const groupAssignmentId = RoleAssignmentId(
          "roleAssignment_00000000000000000000000002"
        )
        yield* sql`insert into ${objects} ${insertValues(
          sql,
          objects,
          objectRow({
            ancestorIds: [groupCompanyId, ROOT_ID],
            id: groupAssignmentId,
            objectType: "roleAssignment",
            parentId: groupCompanyId,
          })
        )}`
        yield* sql`insert into ${roleAssignments} ${insertValues(
          sql,
          roleAssignments,
          {
            parentId: groupCompanyId,
            id: groupAssignmentId,
            principalId: groupId,
            roleId: readerRoleId,
          }
        )}`

        const groupList = yield* asUser(companyService.list())
        const allowedBatch = yield* asUser(
          companyService.batchGet({
            ids: [allowedCompanyId, groupCompanyId],
          })
        )
        const groupCapability = yield* asUser(
          authorization.checkCapabilities([
            { permission: "company.get", target: groupCompanyId },
          ])
        )

        yield* sql`delete
          from ${objects}
          where ${objects.columns.id} = ${membershipId}`
        const afterRevocation = yield* asUser(companyService.list())
        const revokedCapability = yield* asUser(
          authorization.checkCapabilities([
            { permission: "company.get", target: groupCompanyId },
          ])
        )

        const systemList = yield* companyService
          .list()
          .pipe(Effect.provideService(CurrentInvocation, systemInvocation))

        const roleAssignmentRepository =
          yield* RoleAssignmentRepository.make.pipe(
            Effect.provideService(ObjectRepositories, objectRepositories)
          )
        const roleAssignmentService = yield* RoleAssignmentService.make.pipe(
          Effect.provide(
            Links.layer.pipe(Layer.provide(ObjectRepositories.layer))
          ),
          Effect.provideService(
            AuthorizationRepository,
            authorizationRepository
          ),
          Effect.provideService(Authorization, authorization),
          Effect.provideService(RecordIdentifierResolver, identifiers),
          Effect.provideService(
            RoleAssignmentRepository,
            roleAssignmentRepository
          ),
          Effect.provideService(ObjectRepositories, objectRepositories)
        )
        const userAdministratorAssignmentId = RoleAssignmentId(
          "role_assignment_user_root_admin"
        )
        yield* sql`insert into ${objects} ${insertValues(
          sql,
          objects,
          objectRow({
            ancestorIds: [ROOT_ID],
            id: userAdministratorAssignmentId,
            objectType: "roleAssignment",
            parentId: ROOT_ID,
          })
        )}`
        yield* sql`insert into ${roleAssignments} ${insertValues(
          sql,
          roleAssignments,
          {
            parentId: ROOT_ID,
            id: userAdministratorAssignmentId,
            principalId: userId,
            roleId: ADMINISTRATOR_ROLE_ID,
          }
        )}`
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
            parent: ROOT_ID,
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
        yield* sql`delete
          from ${objects}
          where ${objects.columns.id} = ${SYSTEM_ROLE_ASSIGNMENT_ID}`
        const systemAfterGrantRemoval = yield* companyService
          .list()
          .pipe(
            Effect.flip,
            Effect.provideService(CurrentInvocation, systemInvocation)
          )

        return {
          afterRevocation,
          allowedBatch,
          anonymousAdmission,
          authenticatedAdmission,
          attributedActor,
          deniedBatch,
          deniedUpdate,
          directCapabilities,
          delegatedCapabilities,
          directGet,
          directList,
          groupList,
          groupCapability,
          hiddenGet,
          lastAdministrator,
          protectedSystemAssignment,
          publicAdmission,
          publicAdmissionFromInvocation,
          revokedCapability,
          systemAfterGrantRemoval,
          systemList,
          wrongScope,
        }
      }).pipe(Effect.provide(PageTokens.layerTest))

      expect(result.directList.items.map(({ id }) => id)).toEqual([
        allowedCompanyId,
      ])
      expect(result.directGet.id).toBe(allowedCompanyId)
      expect(result.anonymousAdmission.results).toEqual([{ allowed: false }])
      expect(result.authenticatedAdmission.results).toEqual([
        { allowed: false },
      ])
      expect(result.publicAdmission.results).toEqual([{ allowed: true }])
      expect(result.publicAdmissionFromInvocation.results).toEqual([
        { allowed: true },
      ])
      expect(result.hiddenGet).toBeInstanceOf(AuthorizationTargetNotFound)
      expect(result.deniedUpdate).toBeInstanceOf(PermissionDenied)
      expect(result.deniedBatch).toBeInstanceOf(AuthorizationTargetNotFound)
      expect(result.directCapabilities.results).toEqual([
        { allowed: true },
        { allowed: true },
        { allowed: false },
        { allowed: false },
      ])
      expect(result.delegatedCapabilities.results).toEqual([{ allowed: true }])
      expect(result.attributedActor).toBe(
        "serviceAccount_0000000000000000000001"
      )
      expect(result.groupList.items.map(({ id }) => id)).toEqual(
        expect.arrayContaining([allowedCompanyId, groupCompanyId])
      )
      expect(result.groupList.items).toHaveLength(2)
      expect(result.allowedBatch.items.map(({ id }) => id)).toEqual([
        allowedCompanyId,
        groupCompanyId,
      ])
      expect(result.groupCapability.results).toEqual([{ allowed: true }])
      expect(result.afterRevocation.items.map(({ id }) => id)).toEqual([
        allowedCompanyId,
      ])
      expect(result.revokedCapability.results).toEqual([{ allowed: false }])
      expect(result.systemList.items.map(({ id }) => id)).toEqual(
        expect.arrayContaining([allowedCompanyId, groupCompanyId])
      )
      expect(result.systemList.items).toHaveLength(2)
      expect(result.systemAfterGrantRemoval).toMatchObject({
        _tag: "PermissionDenied",
        permission: "company.list",
      })
      expect(result.wrongScope).toBeInstanceOf(RoleScopeMismatch)
      expect(result.protectedSystemAssignment).toBeInstanceOf(PermissionDenied)
      expect(result.lastAdministrator).toBeInstanceOf(LastAdministrator)
    }),
    10_000
  )
})
