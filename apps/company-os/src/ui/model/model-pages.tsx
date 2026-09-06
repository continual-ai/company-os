import {
  useObjectUi,
  type CollectionUiProps,
  type RecordPageUiProps,
} from "./module-ui"
import { ObjectCollection } from "./object-collection"
import { ObjectRecordPage } from "./object-record-page"
import { objectHref } from "./object-routing"

/** A module can replace the page while retaining the standard URL and route state. */
export function ModelCollectionPage(props: CollectionUiProps) {
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
export function ModelRecordPage(props: RecordPageUiProps) {
  const ui = useObjectUi(props.object)
  const Component = ui?.record?.pageComponent
  return Component ? (
    <Component {...props} />
  ) : (
    <ObjectRecordPage
      {...props}
      overviewComponent={ui?.record?.overviewComponent}
      additionalTabs={ui?.record?.additionalTabs}
      actions={ui?.actions}
    />
  )
}
