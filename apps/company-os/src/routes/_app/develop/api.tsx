import { Model } from "@company/model"
import { createFileRoute } from "@tanstack/react-router"
import { Schema } from "effect"

import { pageOptions } from "@/route-metadata"
import { OpenApiReference } from "@/ui/develop/openapi-reference"

const page = {
  breadcrumb: "API reference",
  description: "Explore the OpenAPI contract generated from the domain model.",
  title: "API reference",
}
const salesApiTags = Model.modules.sales.objects.map(
  (object) => object.pluralName
)
const ApiReferenceSearch = Schema.Struct({
  operation: Schema.optional(Schema.String),
})

export const Route = createFileRoute("/_app/develop/api")({
  ...pageOptions(page),
  validateSearch: Schema.decodeUnknownSync(ApiReferenceSearch),
  component: ApiReferencePage,
})

function ApiReferencePage() {
  const { operation } = Route.useSearch()
  const navigate = Route.useNavigate()

  return (
    <OpenApiReference
      initialTag={Model.objects.company.pluralName}
      preferredTags={salesApiTags}
      {...(operation === undefined ? {} : { selectedOperationId: operation })}
      onSelectedOperationChange={(nextOperation) => {
        void navigate({
          replace: true,
          search: { operation: nextOperation },
        })
      }}
    />
  )
}
