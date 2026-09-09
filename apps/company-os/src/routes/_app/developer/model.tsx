import { createFileRoute } from "@tanstack/react-router"
import { Schema } from "effect"

import { EnabledModel } from "#/app.model.ts"
import { ModelExplorer } from "#/app/ui/developer/model-explorer.tsx"
import { pageOptions } from "#/app/ui/route-metadata.ts"

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
      model={EnabledModel}
      {...(item === undefined ? {} : { selectedItem: item })}
      onSelectedItemChange={(nextItem) => {
        void navigate({ replace: true, search: { item: nextItem } })
      }}
    />
  )
}
