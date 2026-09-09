import { createFileRoute } from "@tanstack/react-router"
import { Schema } from "effect"

import { ModelExplorer } from "#/app/ui/developer/model-explorer.tsx"
import { pageOptions } from "#/app/ui/route-metadata.ts"
import { useModelRuntime } from "#/runtime/ui/model/runtime-context.tsx"

const page = {
  breadcrumb: "Domain model",
  description:
    "Explore the object types, properties, links, and governed actions.",
  title: "Domain model",
}
const ModelBrowserSearch = Schema.Struct({
  item: Schema.optional(Schema.String),
})

export const Route = createFileRoute("/_app/developer/model")({
  ...pageOptions(page),
  validateSearch: Schema.decodeUnknownSync(ModelBrowserSearch),
  component: ModelOverview,
})

function ModelOverview() {
  const { model } = useModelRuntime()
  const { item } = Route.useSearch()
  const navigate = Route.useNavigate()

  return (
    <ModelExplorer
      model={model}
      {...(item === undefined ? {} : { selectedItem: item })}
      onSelectedItemChange={(nextItem) => {
        void navigate({ replace: true, search: { item: nextItem } })
      }}
    />
  )
}
