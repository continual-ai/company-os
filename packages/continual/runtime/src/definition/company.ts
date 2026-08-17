import { definitionId } from "./identity"
import type { DefinedModule } from "./module"

export interface DefinedCompany {
  id: string
  kind: "company"
  modules: ReadonlyArray<DefinedModule>
  name: string
}

export function defineCompany(definition: {
  id: string
  modules: ReadonlyArray<DefinedModule>
  name: string
}): DefinedCompany {
  const ids = definition.modules.flatMap((module) =>
    module.objects.map((object) => object.id)
  )
  const duplicate = ids.find((id, index) => ids.indexOf(id) !== index)

  if (duplicate) {
    throw new Error(`Object id '${duplicate}' is registered more than once.`)
  }

  return {
    kind: "company",
    ...definition,
    id: definitionId(definition.id),
  }
}
