import { Context, Layer } from "effect"

import { createCapabilities } from "#/runtime/client/capabilities.ts"
import { createEventFactSchema } from "#/runtime/client/events.ts"
import type { ModelCatalog, ObjectType } from "#/runtime/model/index.ts"
import { createPermissionCatalog } from "#/runtime/server/authorization/permission-catalog.ts"
import {
  makePostgresSchema,
  type ObjectTable,
} from "#/runtime/server/postgres/schema.ts"

function createModelContext(model: ModelCatalog) {
  const storage = makePostgresSchema(model)
  return {
    model,
    storage,
    capabilities: createCapabilities(model),
    permissions: createPermissionCatalog(model),
    eventFactSchema: createEventFactSchema(model),
    table<O extends ObjectType>(object: O): ObjectTable<O> {
      if (
        model.objects[object.id] !== object &&
        !Object.values(model.modules).some((module) =>
          module.objects.includes(object)
        )
      )
        throw new Error(`Object '${object.id}' is not installed in this model.`)
      // SAFETY: storage was compiled from this exact object definition.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      return storage.objects[object.id] as ObjectTable<O>
    },
  }
}
/** One immutable composed model per runtime. Never holds caller or transaction state. */
export class ModelContext extends Context.Service<
  ModelContext,
  ReturnType<typeof createModelContext>
>()("@company/runtime/ModelContext") {
  static layer(model: ModelCatalog) {
    return Layer.succeed(this, createModelContext(model))
  }
}
