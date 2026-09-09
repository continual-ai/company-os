import type { ComponentType, ReactNode } from "react"

import type { ObjectType, ObjectRecord } from "#/runtime/model/index.ts"
import type { FormControlAccessibility } from "#/runtime/ui/forms/form-value.ts"
import type {
  ObjectCollectionSearch,
  ObjectCollectionView,
  ObjectCollectionViewState,
} from "#/runtime/ui/model/collection-view.ts"

type ActionId<O extends ObjectType> = keyof O["actions"] & string
export interface RecordUiProps<O extends ObjectType> {
  readonly record: ObjectRecord<O>
  readonly author?: string | undefined
  readonly can: (action: ActionId<O>) => boolean
}

/** One object's reusable presentation in collection feeds and related-record previews. */
export interface RecordSummaryProps<O extends ObjectType> {
  readonly record: ObjectRecord<O>
  readonly author?: string | undefined
  readonly href: string
  readonly variant: "feed" | "preview"
  readonly actions?: ReactNode
}

/** The effective filters/sort are present even when selected through a saved view. */
export interface CollectionToolbarProps {
  readonly object: ObjectType
  readonly search: ObjectCollectionSearch & {
    readonly state: ObjectCollectionViewState
  }
  readonly can: (actionId: string, target?: string) => boolean
}

export interface CollectionUiProps<O extends ObjectType = ObjectType> {
  readonly object: O
  readonly search?: ObjectCollectionSearch | undefined
  readonly onSearchChange?:
    | ((search: ObjectCollectionSearch) => void)
    | undefined
}
export interface RecordPageUiProps<O extends ObjectType = ObjectType> {
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
export interface ObjectUi<O extends ObjectType> {
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
