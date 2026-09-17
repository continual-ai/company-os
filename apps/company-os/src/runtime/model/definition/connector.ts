import { definitionId } from "#/runtime/model/definition/identity.ts"

/** Browser-safe catalog metadata; authentication implementation belongs in server code. */
export interface ConnectorDefinition {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly authentication: "token"
}

export function defineConnector<const D extends ConnectorDefinition>(
  definition: D
): D {
  definitionId(definition.id)
  return definition
}
