import type { ActionDefinition } from "./action"
import { definitionId } from "./identity"
import { schema } from "./schema"

/** Shared schema binding for custom Queries and Actions; execution semantics stay with the caller. */
export function bindOperationContract(
  object: { readonly id: string },
  id: string,
  definition: Omit<ActionDefinition, "destructive" | "idempotent">
) {
  const operationId = definitionId(id)
  const key = `${object.id}.${operationId}`
  if (definition.scope === "object" && definition.input?.id !== undefined)
    throw new Error(
      `Operation '${key}' receives its 'id' from the object scope and cannot redeclare it.`
    )
  const errors = definition.errors ?? []
  const reasons = new Set<string>()
  for (const error of errors) {
    if (reasons.has(error.reason))
      throw new Error(
        `Operation '${key}' declares error '${error.reason}' more than once.`
      )
    reasons.add(error.reason)
  }
  return {
    id: operationId,
    objectType: object.id,
    name: definition.name,
    description: definition.description,
    scope: definition.scope,
    errors,
    input: schema.object(
      definition.scope === "object"
        ? { id: schema.reference(object), ...definition.input }
        : (definition.input ?? {})
    ),
    output: schema.object(definition.output ?? {}),
  }
}
