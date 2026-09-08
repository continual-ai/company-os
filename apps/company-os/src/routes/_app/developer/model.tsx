import { createFileRoute } from "@tanstack/react-router"
import { Schema } from "effect"

import { Model } from "#/app.model.ts"
import { pageOptions } from "#/route-metadata.ts"
import { ModelExplorer } from "#/ui/developer/model-explorer.tsx"

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
  const { item } = Route.useSearch()
  const navigate = Route.useNavigate()

  return (
    <ModelExplorer
      model={Model}
      {...(item === undefined ? {} : { selectedItem: item })}
      onSelectedItemChange={(nextItem) => {
        void navigate({ replace: true, search: { item: nextItem } })
      }}
    />
  )
}
