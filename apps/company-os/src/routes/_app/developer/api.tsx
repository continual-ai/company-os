import { createFileRoute } from "@tanstack/react-router"
import { Schema } from "effect"

import { EnabledModel } from "#/app.model.ts"
import { OpenApiReference } from "#/app/ui/developer/openapi-reference.tsx"
import { pageOptions } from "#/app/ui/route-metadata.ts"

const page = {
  breadcrumb: "API reference",
  description: "Explore the OpenAPI contract generated from the domain model.",
  title: "API reference",
}
const modelApiTags = Object.values(EnabledModel.modules).flatMap((module) =>
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
