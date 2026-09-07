import {
  modelRelationships,
  modelTypeAccepts,
  type ModuleDefinition,
  type ObjectRecord,
} from "@company/runtime"
import { Model } from "company-os/model"
import {
  createContext,
  useContext,
  type ComponentType,
  type ReactNode,
} from "react"

import type { FormControlAccessibility } from "@/ui/forms/form-field"

import { collectionLayoutError } from "./collection-layout"
import type { ClientRecord, ModelObject } from "./object-client"
import type {
  ObjectCollectionSearch,
  ObjectCollectionView,
  ObjectCollectionViewState,
} from "./object-collection-view"

type ActionId<O extends ModelObject> = keyof O["actions"] & string
export interface RecordUiProps<O extends ModelObject> {
  readonly record: ObjectRecord<O>
  readonly author?: string | undefined
  readonly can: (action: ActionId<O>) => boolean
}

/** One object's reusable presentation in collection feeds and related-record previews. */
export interface RecordSummaryProps<O extends ModelObject> {
  readonly record: ObjectRecord<O>
  readonly author?: string | undefined
  readonly href: string
  readonly variant: "feed" | "preview"
  readonly actions?: ReactNode
}

/** The effective filters/sort are present even when selected through a saved view. */
export interface CollectionToolbarProps {
  readonly object: ModelObject
  readonly search: ObjectCollectionSearch & {
    readonly state: ObjectCollectionViewState
  }
  readonly can: (actionId: string, target?: string) => boolean
}

export interface CollectionUiProps<O extends ModelObject = ModelObject> {
  readonly object: O
  readonly search?: ObjectCollectionSearch | undefined
  readonly onSearchChange?:
    | ((search: ObjectCollectionSearch) => void)
    | undefined
}
export interface RecordPageUiProps<O extends ModelObject = ModelObject> {
  readonly object: O
  readonly recordId: string
  readonly tab?: string | undefined
  readonly onTabChange?: ((tab: string) => void) | undefined
}

/** Editors receive TanStack Form input values; the model decodes them at submission. */
export interface FieldEditorProps extends FormControlAccessibility {
  readonly id: string
  readonly name: string
  readonly required: boolean
}

/** An object's explicit UI contributions. Page replacements own their content;
 * standard pages receive the remaining extensions through ordinary React props. */
export interface ObjectUi<O extends ModelObject> {
  /** Replaces property editors while preserving the shared form and decoder. */
  readonly fieldEditors?: Partial<
    Record<keyof O["properties"] & string, ComponentType<FieldEditorProps>>
  >
  readonly navigation?:
    | {
        readonly hidden?: boolean
        readonly path?: `/${string}`
        readonly description?: string
        readonly order?: number
        readonly icon?: ComponentType<{ className?: string }>
      }
    | undefined
  readonly actions?:
    | Partial<
        Record<
          ActionId<O>,
          {
            readonly component: ComponentType<RecordUiProps<O>>
            readonly placements: ReadonlyArray<"record" | "row">
          }
        >
      >
    | undefined
  readonly collection?:
    | {
        /** Adds controls beside the collection's standard controls. */
        readonly toolbarComponent?: ComponentType<CollectionToolbarProps>
        readonly views?: ReadonlyArray<ObjectCollectionView>
        readonly pageComponent?: ComponentType<CollectionUiProps<O>>
      }
    | undefined
  readonly record?:
    | {
        /** Overrides the record-page heading and breadcrumb; other identities use model display. */
        readonly title?: (props: RecordUiProps<O>) => string
        readonly summaryComponent?: ComponentType<RecordSummaryProps<O>>
        /** Ordered detail fields; remaining fields follow in model order. */
        readonly properties?: ReadonlyArray<keyof O["properties"] & string>
        /** Prioritized relationship tabs; remaining relationships stay searchable. */
        readonly relationships?: ReadonlyArray<string>
        readonly pageComponent?: ComponentType<RecordPageUiProps<O>>
        /** Replaces the main overview; details and other tabs remain available. */
        readonly overviewComponent?: ComponentType<RecordUiProps<O>>
        readonly additionalTabs?: ReadonlyArray<{
          readonly id: string
          readonly label: string
          readonly component: ComponentType<RecordUiProps<O>>
        }>
      }
    | undefined
}

type ModuleUi<M extends ModuleDefinition> = {
  readonly [
    Id in M["objects"][number]["id"]
  ]?: Id extends keyof typeof Model.objects
    ? ObjectUi<(typeof Model.objects)[Id]>
    : never
}

interface DynamicRecordProps {
  readonly author?: string | undefined
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
    for (const field of config.record?.properties ?? []) {
      if (!Object.hasOwn(object.properties, field))
        throw new Error(`Unknown overview property '${id}.${field}'.`)
    }
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
  }
  return { module, objects: configurations }
}

export function composeModelUi(
  ...modules: ReadonlyArray<ReturnType<typeof defineModuleUi>>
) {
  const objects: Record<string, ResolvedObjectUi> = {}
  for (const module of modules) {
    if (
      !Object.values(Model.modules).some(
        (installed) => installed === module.module
      )
    )
      throw new Error(
        `UI module '${module.module.id}' is not installed in the model.`
      )
    for (const [id, config] of Object.entries(module.objects)) {
      if (Object.hasOwn(objects, id))
        throw new Error(`Duplicate UI extension for '${id}'.`)
      objects[id] = config
    }
  }
  return objects
}

const ModelUiContext = createContext<Readonly<
  Record<string, ResolvedObjectUi>
> | null>(null)
export function ModelUiProvider({
  value,
  children,
}: {
  readonly value: Readonly<Record<string, ResolvedObjectUi>>
  readonly children: ReactNode
}) {
  return <ModelUiContext value={value}>{children}</ModelUiContext>
}
export function useObjectUi(object: ModelObject) {
  const ui = useContext(ModelUiContext)
  if (ui === null) throw new Error("Model UI requires ModelUiProvider.")
  return ui[object.id]
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
