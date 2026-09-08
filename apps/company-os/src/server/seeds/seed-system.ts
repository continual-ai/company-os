import { bootstrapSystemActor } from "@company/runtime/server/access/bootstrap"
import { seedAuthorization } from "@company/runtime/server/access/seed"
import { createPermissionCatalog } from "@company/runtime/server/authorization/permission-catalog"
import { CurrentInvocation } from "@company/runtime/server/invocation"
import { systemInvocation } from "@company/runtime/server/invocation-context"
import { ModelContext } from "@company/runtime/server/model-context"
import { Effect } from "effect"

/** Converges every required system record in dependency order. */
export const seedSystem = Effect.fn("@company/seedSystem")(function* () {
  const { model } = yield* ModelContext
  const { definedPermissions } = createPermissionCatalog(model)
  const business = new Set(
    Object.values(model.modules)
      .filter((module) => module.id !== "access")
      .flatMap((module) => module.objects.map((object) => object.id))
  )
  const operatorPermissions = definedPermissions.filter((permission) =>
    business.has(permission.split(".")[0]!)
  )
  yield* bootstrapSystemActor()
  yield* seedAuthorization(operatorPermissions).pipe(
    Effect.provideService(CurrentInvocation, systemInvocation)
  )
})
