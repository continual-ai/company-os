import { Context, Layer } from "effect"

import { createEventFactSchema } from "#/runtime/contract/events.ts"
import type { ModelCatalog, ObjectType } from "#/runtime/model/index.ts"
import {
  makePostgresSchema,
  type ObjectTable,
} from "#/runtime/server/storage/schema.ts"

function createModelContext(model: ModelCatalog) {
  const storage = makePostgresSchema(model)
  const installed = (object: ObjectType): boolean =>
    model.objects[object.id] === object ||
    Object.values(model.modules).some((module) =>
      module.objects.includes(object)
    )
  return {
    model,
    storage,
    eventFactSchema: createEventFactSchema(model),
    /** Whether this exact definition is part of the composed model, not merely an object with the same id. */
    installed,
    table<O extends ObjectType>(object: O): ObjectTable<O> {
      if (!installed(object))
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
