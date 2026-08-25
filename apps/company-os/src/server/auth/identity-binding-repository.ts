import { RecordId } from "@company/runtime"
import { and, eq } from "drizzle-orm"
import { Context, Effect, Layer } from "effect"

import { Database } from "@/server/database/database"
import {
  authUserBindings,
  authSession,
  roleAssignments,
  users,
} from "@/server/database/schema"
import { PLATFORM_ADMIN_ROLE_ID, PLATFORM_ID } from "@/system-records"

const make = Effect.gen(function* () {
  const database = yield* Database

  const findUserId = Effect.fn("@company/IdentityBindingRepository.findUserId")(
    function* (authUserId: string) {
      const rows = yield* database
        .select({ userId: authUserBindings.userId })
        .from(authUserBindings)
        .where(eq(authUserBindings.authUserId, authUserId))
        .limit(1)
      const userId = rows[0]?.userId
      return userId === undefined ? undefined : RecordId("user")(userId)
    }
  )

  const findAuthUserId = Effect.fn(
    "@company/IdentityBindingRepository.findAuthUserId"
  )(function* (userId: RecordId<"user">) {
    const rows = yield* database
      .select({ authUserId: authUserBindings.authUserId })
      .from(authUserBindings)
      .where(eq(authUserBindings.userId, userId))
      .limit(1)
    return rows[0]?.authUserId
  })

  const hasUserPlatformAdministrator = Effect.fn(
    "@company/IdentityBindingRepository.hasUserPlatformAdministrator"
  )(function* () {
    const rows = yield* database
      .select({ id: roleAssignments.id })
      .from(roleAssignments)
      .innerJoin(users, eq(roleAssignments.principalId, users.id))
      .where(
        and(
          eq(roleAssignments.parentId, PLATFORM_ID),
          eq(roleAssignments.roleId, PLATFORM_ADMIN_ROLE_ID),
          eq(users.status, "active")
        )
      )
      .limit(1)
    return rows.length !== 0
  })

  const isLastActivePlatformAdministrator = Effect.fn(
    "@company/IdentityBindingRepository.isLastActivePlatformAdministrator"
  )(function* (userId: RecordId<"user">) {
    const rows = yield* database
      .select({ userId: users.id })
      .from(roleAssignments)
      .innerJoin(users, eq(roleAssignments.principalId, users.id))
      .where(
        and(
          eq(roleAssignments.parentId, PLATFORM_ID),
          eq(roleAssignments.roleId, PLATFORM_ADMIN_ROLE_ID),
          eq(users.status, "active")
        )
      )
      .limit(2)
    return rows.length === 1 && rows[0]?.userId === userId
  })

  const bind = Effect.fn("@company/IdentityBindingRepository.bind")(function* (
    authUserId: string,
    userId: RecordId<"user">
  ) {
    yield* database.insert(authUserBindings).values({ authUserId, userId })
  })

  const revokeSessions = Effect.fn(
    "@company/IdentityBindingRepository.revokeSessions"
  )(function* (userId: RecordId<"user">) {
    const authUserId = yield* findAuthUserId(userId)
    if (authUserId !== undefined) {
      yield* database
        .delete(authSession)
        .where(eq(authSession.userId, authUserId))
    }
  })

  return {
    bind,
    findAuthUserId,
    findUserId,
    hasUserPlatformAdministrator,
    isLastActivePlatformAdministrator,
    revokeSessions,
  }
})

export class IdentityBindingRepository extends Context.Service<IdentityBindingRepository>()(
  "@company/IdentityBindingRepository",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
