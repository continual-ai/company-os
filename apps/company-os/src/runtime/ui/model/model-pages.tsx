import { Tabs, TabsContent, TabsList, TabsTrigger } from "@company/ui/tabs"
import { useState } from "react"

import { useObjectUi } from "#/runtime/ui/model/module-ui.tsx"
import { ObjectCollection } from "#/runtime/ui/model/object-collection.tsx"
import { ObjectControllers } from "#/runtime/ui/model/object-controllers.tsx"
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
  const [localTab, setLocalTab] = useState("records")
  const controllers = Object.values(runtime.model.modules)
    .flatMap((module) => module.controllers)
    .filter((controller) => controller.objectType === props.object.id)
  const content = Component ? (
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
  if (controllers.length === 0) return content
  return (
    <Tabs
      value={props.search ? (props.search.tab ?? "records") : localTab}
      onValueChange={(tab) => {
        setLocalTab(tab)
        props.onSearchChange?.({
          ...props.search,
          tab: tab === "controllers" ? "controllers" : undefined,
        })
      }}
      className="min-h-0 flex-1 gap-0"
    >
      <div className="border-b px-page-gutter">
        <TabsList variant="header">
          <TabsTrigger value="records">{props.object.pluralName}</TabsTrigger>
          <TabsTrigger value="controllers">Controllers</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="records" className="min-h-0 flex-1">
        {content}
      </TabsContent>
      <TabsContent value="controllers" className="min-h-0 flex-1 overflow-auto">
        <ObjectControllers objectType={props.object.id} />
      </TabsContent>
    </Tabs>
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
      overviewRelationships={ui?.record?.overviewRelationships}
      title={ui?.record?.title}
      additionalTabs={ui?.record?.additionalTabs}
      actions={ui?.actions}
    />
  )
}
