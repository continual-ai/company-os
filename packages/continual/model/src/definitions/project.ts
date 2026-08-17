import { definitionId } from "./identity"
import type { DefinedModule } from "./module"

export type AppKind = "api" | "portal" | "website" | "workspace"

export interface DefinedApp {
  id: string
  kind: "app"
  name: string
  source: string
  type: AppKind
}

export function defineApp(definition: {
  id: string
  name: string
  source: string
  type: AppKind
}): DefinedApp {
  return {
    kind: "app",
    ...definition,
    id: definitionId(definition.id),
  }
}

export interface DefinedProject {
  apps: ReadonlyArray<DefinedApp>
  id: string
  kind: "project"
  modules: ReadonlyArray<DefinedModule>
  name: string
}

export function defineProject(definition: {
  apps: ReadonlyArray<DefinedApp>
  id: string
  modules: ReadonlyArray<DefinedModule>
  name: string
}): DefinedProject {
  const ids = definition.modules.flatMap((module) =>
    module.objects.map((object) => object.id)
  )
  const duplicate = ids.find((id, index) => ids.indexOf(id) !== index)

  if (duplicate) {
    throw new Error(`Object id '${duplicate}' is registered more than once.`)
  }

  return {
    kind: "project",
    ...definition,
    id: definitionId(definition.id),
  }
}
