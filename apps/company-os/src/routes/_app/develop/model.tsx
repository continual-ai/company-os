import { Model } from "@company/model"
import { createFileRoute } from "@tanstack/react-router"
import { Schema } from "effect"

import { pageOptions } from "@/route-metadata"
import { ModelExplorer } from "@/ui/model/model-explorer"

const page = {
  breadcrumb: "Domain model",
  description:
    "Explore the object types, properties, links, and governed actions.",
  title: "Domain model",
}
const ModelBrowserSearch = Schema.Struct({
  item: Schema.optional(Schema.String),
})

export const Route = createFileRoute("/_app/develop/model")({
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
