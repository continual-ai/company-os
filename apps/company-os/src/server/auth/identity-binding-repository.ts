import { RecordId } from "@company/runtime"
import { and, eq } from "drizzle-orm"
import { Context, Effect, Layer } from "effect"

import {
  PLATFORM_ADMIN_ROLE_ID,
  PLATFORM_ID,
} from "@/server/authorization/well-known-authorization"
import { Database } from "@/server/database/database"
import {
  authUserBindings,
  roleAssignments,
  users,
} from "@/server/database/schema"

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
          eq(roleAssignments.roleId, PLATFORM_ADMIN_ROLE_ID)
        )
      )
      .limit(1)
    return rows.length !== 0
  })

  const bind = Effect.fn("@company/IdentityBindingRepository.bind")(function* (
    authUserId: string,
    userId: RecordId<"user">
  ) {
    yield* database.insert(authUserBindings).values({ authUserId, userId })
  })

  return {
    bind,
    findUserId,
    hasUserPlatformAdministrator,
  }
})

export class IdentityBindingRepository extends Context.Service<IdentityBindingRepository>()(
  "@company/IdentityBindingRepository",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
