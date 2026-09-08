import {
  type CollectionUiProps,
  type RecordPageUiProps,
} from "@company/ui/model/object-ui"

import { useRecordVisit } from "#/ui/application/use-recent-records.tsx"
import { useObjectUi } from "#/ui/model/module-ui.tsx"
import type { ModelObject } from "#/ui/model/object-client.ts"
import { ObjectCollection } from "#/ui/model/object-collection.tsx"
import { ObjectRecordPage } from "#/ui/model/object-record-page.tsx"
import { objectHref } from "#/ui/model/object-routing.ts"

/** A module can replace the page while retaining the standard URL and route state. */
export function ModelCollectionPage(props: CollectionUiProps<ModelObject>) {
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
      recordHref={(id) => objectHref(props.object, id)}
    />
  )
}
export function ModelRecordPage(props: RecordPageUiProps<ModelObject>) {
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
