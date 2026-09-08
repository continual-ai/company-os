import { createFileRoute } from "@tanstack/react-router"
import { Schema } from "effect"

import { Model } from "#/app.model.ts"
import { pageOptions } from "#/route-metadata.ts"
import { OpenApiReference } from "#/ui/developer/openapi-reference.tsx"

const page = {
  breadcrumb: "API reference",
  description: "Explore the OpenAPI contract generated from the domain model.",
  title: "API reference",
}
const modelApiTags = Object.values(Model.modules).flatMap((module) =>
  module.objects.map((object) => object.pluralName)
)
const ApiReferenceSearch = Schema.Struct({
  operation: Schema.optional(Schema.String),
})

export const Route = createFileRoute("/_app/developer/api")({
  ...pageOptions(page),
  validateSearch: Schema.decodeUnknownSync(ApiReferenceSearch),
  component: ApiReferencePage,
})

function ApiReferencePage() {
  const { operation } = Route.useSearch()
  const navigate = Route.useNavigate()

  return (
    <OpenApiReference
      preferredTags={modelApiTags}
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
