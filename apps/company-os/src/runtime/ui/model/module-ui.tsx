import { type ComponentType } from "react"

import {
  modelRelationships,
  modelTypeAccepts,
  type ModuleDefinition,
  type ModelCatalog,
} from "#/runtime/model/index.ts"
import { collectionLayoutError } from "#/runtime/ui/model/collection-layout.ts"
import type { ObjectRecordPresentation } from "#/runtime/ui/model/object-client.ts"
import type {
  ClientRecord,
  ModelObject,
} from "#/runtime/ui/model/object-client.ts"
import type {
  ObjectUi,
  FieldEditorProps,
  RecordSummaryProps,
  RecordPageUiProps,
} from "#/runtime/ui/model/object-ui.ts"
import { useModelRuntime } from "#/runtime/ui/model/runtime-context.tsx"

type ModuleUi<M extends ModuleDefinition> = {
  readonly [Id in M["objects"][number]["id"]]?: ObjectUi<
    Extract<M["objects"][number], { readonly id: Id }>
  >
}

interface DynamicRecordProps {
  readonly author?: ObjectRecordPresentation | undefined
  readonly record: ClientRecord
  readonly can: (action: string) => boolean
}
/** Checked configuration erased to the shared renderer's record representation. */
export interface ResolvedObjectUi {
  readonly fieldEditors?: Readonly<
    Record<string, ComponentType<FieldEditorProps>>
  >
  readonly navigation?: ObjectUi<ModelObject>["navigation"]
  readonly collection?: ObjectUi<ModelObject>["collection"]
  readonly actions?: Readonly<
    Record<
      string,
      {
        readonly component: ComponentType<DynamicRecordProps>
        readonly placements: ReadonlyArray<"record" | "row">
      }
    >
  >
  readonly record?: {
    readonly title?: (props: DynamicRecordProps) => string
    readonly summaryComponent?: ComponentType<
      Omit<RecordSummaryProps<ModelObject>, "record"> & {
        readonly record: ClientRecord
      }
    >
    readonly properties?: ReadonlyArray<string>
    readonly relationships?: ReadonlyArray<string>
    readonly pageComponent?: ComponentType<RecordPageUiProps>
    readonly overviewComponent?: ComponentType<DynamicRecordProps>
    readonly additionalTabs?: ReadonlyArray<{
      readonly id: string
      readonly label: string
      readonly component: ComponentType<DynamicRecordProps>
    }>
  }
}

/** Object keys, action names, and component records are checked against this module's model. */
export function defineModuleUi<M extends ModuleDefinition>(
  module: M,
  objects: ModuleUi<NoInfer<M>>
) {
  // SAFETY: module keys and component props are checked at the authoring boundary.
  // Renderers dispatch only decoded records belonging to that same object.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const configurations = objects as unknown as Readonly<
    Record<string, ResolvedObjectUi>
  >
  const owned = new Set(module.objects.map((object) => object.id))
  for (const [id, config] of Object.entries(configurations)) {
    if (!owned.has(id))
      throw new Error(`Module '${module.id}' cannot extend '${id}'.`)
    const object = module.objects.find((candidate) => candidate.id === id)!
    const viewIds = new Set<string>()
    for (const view of config.collection?.views ?? []) {
      if (viewIds.has(view.id))
        throw new Error(`Duplicate collection view '${id}.${view.id}'.`)
      viewIds.add(view.id)
      const error = collectionLayoutError(
        object,
        view.state.layout ?? { type: "table" }
      )
      if (error) throw new Error(`Invalid view '${id}.${view.id}': ${error}`)
    }
    for (const field of Object.keys(config.fieldEditors ?? {})) {
      if (!Object.hasOwn(object.properties, field))
        throw new Error(`Unknown field '${id}.${field}'.`)
    }
    for (const action of Object.keys(config.actions ?? {})) {
      if (!Object.hasOwn(object.actions, action))
        throw new Error(`Unknown action '${id}.${action}'.`)
    }
    for (const field of config.record?.properties ?? []) {
      if (!Object.hasOwn(object.properties, field))
        throw new Error(`Unknown overview property '${id}.${field}'.`)
    }
  }
  return { module, objects: configurations }
}

export function composeModelUi(
  Model: ModelCatalog,
  ...modules: ReadonlyArray<ReturnType<typeof defineModuleUi>>
) {
  const objects: Record<string, ResolvedObjectUi> = {}
  for (const module of modules) {
    // Contributions for modules outside this model (disabled ones) are skipped.
    if (
      !Object.values(Model.modules).some(
        (installed) => installed === module.module
      )
    )
      continue
    for (const [id, config] of Object.entries(module.objects)) {
      if (Object.hasOwn(objects, id))
        throw new Error(`Duplicate UI extension for '${id}'.`)
      const installedObject = Object.values(Model.objects).find(
        (candidate) => candidate.id === id
      )
      if (!installedObject)
        throw new Error(`Object '${id}' is not installed in the model.`)
      const tabs = new Set<string>([
        "overview",
        "related",
        ...modelRelationships(Model).flatMap((relationship) =>
          [relationship.forward, relationship.reverse]
            .filter((side) =>
              modelTypeAccepts(Model, installedObject.id, side.from.typeId)
            )
            .map((side) => side.key)
        ),
      ])
      for (const key of config.record?.relationships ?? []) {
        if (key === "overview" || key === "related" || !tabs.has(key))
          throw new Error(`Unknown overview relationship '${id}.${key}'.`)
      }
      for (const tab of config.record?.additionalTabs ?? []) {
        if (!/^[a-z][a-zA-Z0-9-]*$/.test(tab.id))
          throw new Error(`Invalid record tab ID '${id}.${tab.id}'.`)
        if (tabs.has(tab.id))
          throw new Error(`Duplicate record tab '${id}.${tab.id}'.`)
        tabs.add(tab.id)
      }
      objects[id] = config
    }
  }
  return objects
}

export function useObjectUi(object: ModelObject) {
  return useModelRuntime().ui[object.id]
}

export function ObjectActions({
  actions,
  record,
  can,
  placement,
}: DynamicRecordProps & {
  readonly actions: ResolvedObjectUi["actions"]
  readonly placement: "row" | "record"
}) {
  return (
    <>
      {Object.entries(actions ?? {}).map(([id, action]) => {
        if (!action.placements.includes(placement) || !can(id)) return null
        const Component = action.component
        return <Component key={id} record={record} can={can} />
      })}
    </>
  )
}
