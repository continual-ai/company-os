import { useObjectUi } from "#/runtime/ui/model/module-ui.tsx"
import { ObjectCollection } from "#/runtime/ui/model/object-collection.tsx"
import { ObjectRecordPage } from "#/runtime/ui/model/object-record-page.tsx"
import { objectHref } from "#/runtime/ui/model/object-routing.ts"
import {
  type CollectionUiProps,
  type RecordPageUiProps,
} from "#/runtime/ui/model/object-ui.ts"
import { useRecordVisit } from "#/runtime/ui/model/recent-records.tsx"
import { useModelRuntime } from "#/runtime/ui/model/runtime-context.tsx"

/** A module can replace the page while retaining the standard URL and route state. */
export function ModelCollectionPage(props: CollectionUiProps) {
  const runtime = useModelRuntime()

  const ui = useObjectUi(props.object)
  const Component = ui?.collection?.pageComponent
  return Component ? (
    <Component {...props} />
  ) : (
    <ObjectCollection
      {...props}
      views={ui?.collection?.views}
      toolbarComponent={ui?.collection?.toolbarComponent}
      actions={ui?.actions}
      recordHref={(id) => objectHref(runtime, props.object, id)}
    />
  )
}
export function ModelRecordPage(props: RecordPageUiProps) {
  useRecordVisit(props.object.id, props.recordId)
  const ui = useObjectUi(props.object)
  const Component = ui?.record?.pageComponent
  return Component ? (
    <Component {...props} />
  ) : (
    <ObjectRecordPage
      key={`${props.object.id}:${props.recordId}`}
      {...props}
      properties={ui?.record?.properties}
      relationships={ui?.record?.relationships}
      overviewComponent={ui?.record?.overviewComponent}
      title={ui?.record?.title}
      additionalTabs={ui?.record?.additionalTabs}
      actions={ui?.actions}
    />
  )
}
