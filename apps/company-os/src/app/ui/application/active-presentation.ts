import { Model } from "#/app.model.ts"
import { data } from "#/app/app-client.ts"
import { presentation } from "#/app/app-presentation.ts"
import { requiredModuleIds } from "#/modules/platform/model/index.ts"
import { defineModel } from "#/runtime/model/index.ts"

const query = data.moduleSetting.catalog({})
/** This query reads only activation rows, so unrelated business writes do not affect it. */
export const moduleCatalogQuery = {
  ...query,
  meta: { ...query.meta, custom: false },
}

export function activeModuleKey(
  catalog:
    | { modules: ReadonlyArray<{ id: string; enabled: boolean }> }
    | undefined
) {
  return (
    catalog?.modules
      .filter((module) => module.enabled)
      .map((module) => module.id) ?? requiredModuleIds
  ).join(",")
}

export function activePresentation(key: string) {
  const ids = new Set(key.split(","))
  const model = defineModel({
    name: Model.name,
    modules: Object.values(Model.modules).filter((module) =>
      ids.has(module.id)
    ),
  })
  return { ...presentation, model }
}
