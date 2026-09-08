import type { ObjectQueryClient } from "#/client/model-query-client.ts"
import type { ObjectType } from "#/model/index.ts"
import {
  useModelRuntime,
  type ModelUiRuntime,
} from "#/ui/model/runtime-context.tsx"

/** Selects the typed client for an installed definition without coupling a module to its app. */
export function objectQueryClient<O extends ObjectType>(
  runtime: ModelUiRuntime,
  object: O
): ObjectQueryClient<O> {
  if (
    !Object.values(runtime.model.modules).some((module) =>
      module.objects.includes(object)
    ) &&
    runtime.model.objects[object.id] !== object
  )
    throw new Error(`Object '${object.id}' is not installed.`)
  // SAFETY: the provider receives the semantic client built from this same installed model.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return Reflect.get(runtime.data, object.id) as ObjectQueryClient<O>
}
export function useObjectClient<O extends ObjectType>(object: O) {
  return objectQueryClient(useModelRuntime(), object)
}
