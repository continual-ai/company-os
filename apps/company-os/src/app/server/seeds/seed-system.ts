import { Effect } from "effect"

import { seedModuleSettings } from "#/modules/platform/server/index.ts"
import { bootstrapSystemActor } from "#/runtime/access/server/bootstrap.ts"
import { seedAuthorization } from "#/runtime/access/server/seed.ts"
import { createPermissionCatalog } from "#/runtime/server/authorization/permission-catalog.ts"
import { systemInvocation } from "#/runtime/server/invocation-context.ts"
import { CurrentInvocation } from "#/runtime/server/invocation.ts"
import { ModelContext } from "#/runtime/server/model-context.ts"

/** Converges every required system record in dependency order. */
export const seedSystem = Effect.fn("@company/seedSystem")(function* () {
  const { model } = yield* ModelContext
  const { definedPermissions } = createPermissionCatalog(model)
  const business = new Set(
    Object.values(model.modules)
      .filter((module) => module.id !== "access" && module.id !== "platform")
      .flatMap((module) => module.objects.map((object) => object.id))
  )
  const operatorPermissions = definedPermissions.filter((permission) =>
    business.has(permission.split(".")[0]!)
  )
  yield* bootstrapSystemActor()
  yield* seedAuthorization([
    ...operatorPermissions,
    "moduleSetting.catalog",
    "moduleSetting.get",
    "moduleSetting.list",
  ]).pipe(Effect.provideService(CurrentInvocation, systemInvocation))
  yield* seedModuleSettings().pipe(
    Effect.provideService(CurrentInvocation, systemInvocation)
  )
})
