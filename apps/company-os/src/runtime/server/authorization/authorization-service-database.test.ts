import { Effect } from "effect"
import { describe, expect } from "vitest"

import {
  LastAdministrator,
  RoleAssignmentService,
  RoleScopeMismatch,
} from "#/runtime/access/server/role-assignment-service.ts"
import { Etag, RecordId, Timestamp } from "#/runtime/model/index.ts"
import {
  ALL_CALLERS_PRINCIPAL_SET_ID,
  ADMINISTRATOR_ROLE_ID,
  ROOT_ID,
  SYSTEM_SERVICE_ACCOUNT_ID,
  SYSTEM_ROLE_ASSIGNMENT_ID,
} from "#/runtime/model/system-records.ts"
import {
  Authorization,
  AuthorizationTargetNotFound,
  PermissionDenied,
} from "#/runtime/server/authorization/authorization-service.ts"
import {
  anonymousCaller,
  authenticatedCaller,
} from "#/runtime/server/caller.ts"
import {
  anonymousInvocation,
  authenticatedInvocation,
  currentActorId,
  systemInvocation,
} from "#/runtime/server/invocation-context.ts"
import { CurrentInvocation } from "#/runtime/server/invocation.ts"
import { makeObjectService } from "#/runtime/server/model/object-service.ts"
import { Database } from "#/runtime/server/storage/database.ts"
import type { TableRow } from "#/runtime/server/storage/index.ts"
import { insertValues, assignments } from "#/runtime/server/storage/index.ts"
import { Account, fixtureModel } from "#/runtime/testing/fixture-model.ts"
import { FixtureServer } from "#/runtime/testing/fixture-server.ts"
import { testFoundation } from "#/runtime/testing/foundation.ts"

const fixture = testFoundation(fixtureModel, { servers: [FixtureServer] })
const { objects } = fixture.storage.core
const {
  authorizationScope: authorizationScopes,
  identity: identities,
  participant: participants,
  principal: principals,
  topic: topics,
} = fixture.storage.interfaces
const {
  account: accounts,
  group: groups,
  groupMembership: groupMemberships,
  role: roles,
  roleAssignment: roleAssignments,
  user: users,
} = fixture.storage.objects

const now = Timestamp("2026-08-23T00:00:00.000Z")
const UserId = RecordId("user")
const ServiceAccountId = RecordId("serviceAccount")
const AccountId = RecordId("account")
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
  fixture.test(
    "applies direct and group grants through the ownership hierarchy",
    () =>
      Effect.gen(function* () {
        const userId = UserId("user_00000000000000000000000001")
        const allowedAccountId = AccountId("account_00000000000000000000000001")
        const groupAccountId = AccountId("account_00000000000000000000000002")
        const readerRoleId = RoleId("role_00000000000000000000000001")
        const groupId = GroupId("group_00000000000000000000000001")
        const membershipId = GroupMembershipId(
          "groupMembership_00000000000000000000000001"
        )
        const { sql } = yield* Database
        const authorization = yield* Authorization
        const accountService = yield* makeObjectService(Account)
        const roleAssignmentService = yield* RoleAssignmentService

        yield* sql`insert into ${objects} ${insertValues(sql, objects, [
          objectRow({
            ancestorIds: [ROOT_ID],
            id: userId,
            objectType: "user",
            parentId: ROOT_ID,
          }),
          objectRow({
            ancestorIds: [ROOT_ID],
            id: allowedAccountId,
            objectType: "account",
            parentId: ROOT_ID,
          }),
          objectRow({
            ancestorIds: [ROOT_ID],
            id: groupAccountId,
            objectType: "account",
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
          status: "active",
        })}`
        yield* sql`insert into ${identities} ${insertValues(sql, identities, { id: userId })}`
        yield* sql`insert into ${principals} ${insertValues(sql, principals, { id: userId })}`
        yield* sql`insert into ${accounts} ${insertValues(sql, accounts, [
          {
            domain: null,
            id: allowedAccountId,
            industry: null,
            logo: null,
            name: "Allowed",
            parentId: ROOT_ID,
            stage: "prospect",
            website: null,
          },
          {
            domain: null,
            id: groupAccountId,
            industry: null,
            logo: null,
            name: "Via group",
            parentId: ROOT_ID,
            stage: "prospect",
            website: null,
          },
        ])}`
        for (const membership of [authorizationScopes, participants, topics])
          yield* sql`insert into ${membership} ${insertValues(sql, membership, [
            { id: allowedAccountId },
            { id: groupAccountId },
          ])}`
        yield* sql`insert into ${roles} ${insertValues(sql, roles, {
          description: null,
          id: readerRoleId,
          name: "Account reader",
          permissions: ["account.get", "account.list"],
          parentId: ROOT_ID,
          scopeType: "account",
        })}`

        const directAssignmentId = RoleAssignmentId(
          "roleAssignment_00000000000000000000000001"
        )
        yield* sql`insert into ${objects} ${insertValues(
          sql,
          objects,
          objectRow({
            ancestorIds: [allowedAccountId, ROOT_ID],
            id: directAssignmentId,
            objectType: "roleAssignment",
            parentId: allowedAccountId,
          })
        )}`
        yield* sql`insert into ${roleAssignments} ${insertValues(
          sql,
          roleAssignments,
          {
            parentId: allowedAccountId,
            id: directAssignmentId,
            principalId: userId,
            roleId: readerRoleId,
          }
        )}`

        const anonymousAdmission = yield* authorization.checkCapabilitiesFor(
          anonymousCaller,
          [{ permission: "account.get", target: allowedAccountId }]
        )
        const authenticatedAdmission =
          yield* authorization.checkCapabilitiesFor(authenticatedCaller, [
            { permission: "account.get", target: allowedAccountId },
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
          [{ permission: "account.get", target: allowedAccountId }]
        )
        const publicAdmissionFromInvocation = yield* authorization
          .checkCapabilities([
            { permission: "account.get", target: allowedAccountId },
          ])
          .pipe(Effect.provideService(CurrentInvocation, anonymousInvocation))
        yield* sql`delete
          from ${objects}
          where ${objects.columns.id} = ${publicAdmissionAssignmentId}`
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

        const directList = yield* asUser(accountService.list())
        const directGet = yield* asUser(
          accountService.get({ id: allowedAccountId })
        )
        const hiddenGet = yield* asUser(
          accountService.get({ id: groupAccountId }).pipe(Effect.flip)
        )
        const deniedUpdate = yield* asUser(
          accountService
            .update({ id: allowedAccountId, name: "Not allowed" })
            .pipe(Effect.flip)
        )
        const deniedBatch = yield* asUser(
          accountService
            .batchGet({ ids: [allowedAccountId, groupAccountId] })
            .pipe(Effect.flip)
        )
        const directCapabilities = yield* asUser(
          authorization.checkCapabilities([
            { permission: "account.list" },
            { permission: "account.get", target: allowedAccountId },
            { permission: "account.update", target: allowedAccountId },
            { permission: "account.get", target: groupAccountId },
          ])
        )
        // List admission and row readability are separate: list-only never exposes records.
        yield* sql`update ${roles} set ${assignments(sql, roles, { permissions: ["account.list"] })}
          where ${roles.columns.id} = ${readerRoleId}`
        expect((yield* asUser(accountService.list())).items).toEqual([])
        expect(
          yield* asUser(
            accountService.get({ id: allowedAccountId }).pipe(Effect.flip)
          )
        ).toMatchObject({ _tag: "AuthorizationTargetNotFound" })
        yield* sql`update ${roles} set ${assignments(sql, roles, { permissions: ["account.get"] })}
          where ${roles.columns.id} = ${readerRoleId}`
        expect(
          (yield* asUser(accountService.get({ id: allowedAccountId }))).id
        ).toBe(allowedAccountId)
        expect(
          yield* asUser(accountService.list().pipe(Effect.flip))
        ).toMatchObject({
          _tag: "PermissionDenied",
          permission: "account.list",
        })
        yield* sql`update ${roles} set ${assignments(sql, roles, { permissions: ["account.get", "account.list"] })}
          where ${roles.columns.id} = ${readerRoleId}`
        const delegatedCapabilities = yield* authorization
          .checkCapabilities([
            { permission: "account.get", target: allowedAccountId },
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
            ancestorIds: [groupAccountId, ROOT_ID],
            id: groupAssignmentId,
            objectType: "roleAssignment",
            parentId: groupAccountId,
          })
        )}`
        yield* sql`insert into ${roleAssignments} ${insertValues(
          sql,
          roleAssignments,
          {
            parentId: groupAccountId,
            id: groupAssignmentId,
            principalId: groupId,
            roleId: readerRoleId,
          }
        )}`

        const groupList = yield* asUser(accountService.list())
        const allowedBatch = yield* asUser(
          accountService.batchGet({
            ids: [allowedAccountId, groupAccountId],
          })
        )
        const groupCapability = yield* asUser(
          authorization.checkCapabilities([
            { permission: "account.get", target: groupAccountId },
          ])
        )

        yield* sql`delete
          from ${objects}
          where ${objects.columns.id} = ${membershipId}`
        const afterRevocation = yield* asUser(accountService.list())
        const revokedCapability = yield* asUser(
          authorization.checkCapabilities([
            { permission: "account.get", target: groupAccountId },
          ])
        )

        const systemList = yield* accountService.list()

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
        yield* roleAssignmentService.delete({
          id: userAdministratorAssignmentId,
        })
        const wrongScope = yield* roleAssignmentService
          .create({
            parent: ROOT_ID,
            principal: userId,
            role: readerRoleId,
          })
          .pipe(Effect.flip)
        const lastAdministrator = yield* roleAssignmentService
          .delete({ id: SYSTEM_ROLE_ASSIGNMENT_ID })
          .pipe(Effect.flip)
        yield* sql`delete
          from ${objects}
          where ${objects.columns.id} = ${SYSTEM_ROLE_ASSIGNMENT_ID}`
        const systemAfterGrantRemoval = yield* accountService
          .list()
          .pipe(
            Effect.flip,
            Effect.provideService(CurrentInvocation, systemInvocation)
          )

        expect(directList.items.map(({ id }) => id)).toEqual([allowedAccountId])
        expect(directGet.id).toBe(allowedAccountId)
        expect(anonymousAdmission.results).toEqual([{ allowed: false }])
        expect(authenticatedAdmission.results).toEqual([{ allowed: false }])
        expect(publicAdmission.results).toEqual([{ allowed: true }])
        expect(publicAdmissionFromInvocation.results).toEqual([
          { allowed: true },
        ])
        expect(hiddenGet).toBeInstanceOf(AuthorizationTargetNotFound)
        expect(deniedUpdate).toBeInstanceOf(PermissionDenied)
        expect(deniedBatch).toBeInstanceOf(AuthorizationTargetNotFound)
        expect(directCapabilities.results).toEqual([
          { allowed: true },
          { allowed: true },
          { allowed: false },
          { allowed: false },
        ])
        expect(delegatedCapabilities.results).toEqual([{ allowed: true }])
        expect(attributedActor).toBe("serviceAccount_0000000000000000000001")
        expect(groupList.items.map(({ id }) => id)).toEqual(
          expect.arrayContaining([allowedAccountId, groupAccountId])
        )
        expect(groupList.items).toHaveLength(2)
        expect(allowedBatch.items.map(({ id }) => id)).toEqual([
          allowedAccountId,
          groupAccountId,
        ])
        expect(groupCapability.results).toEqual([{ allowed: true }])
        expect(afterRevocation.items.map(({ id }) => id)).toEqual([
          allowedAccountId,
        ])
        expect(revokedCapability.results).toEqual([{ allowed: false }])
        expect(systemList.items.map(({ id }) => id)).toEqual(
          expect.arrayContaining([allowedAccountId, groupAccountId])
        )
        expect(systemList.items).toHaveLength(2)
        expect(systemAfterGrantRemoval).toMatchObject({
          _tag: "PermissionDenied",
          permission: "account.list",
        })
        expect(wrongScope).toBeInstanceOf(RoleScopeMismatch)
        expect(protectedSystemAssignment).toBeInstanceOf(PermissionDenied)
        expect(lastAdministrator).toBeInstanceOf(LastAdministrator)
      }),
    10_000
  )
})
