import { AcmeModel } from "@acme/api"
import { createFileRoute } from "@tanstack/react-router"

import { ModelExplorer } from "@/components/model-explorer"
import { pageOptions } from "@/route-metadata"

const page = {
  breadcrumb: "Domain model",
  description:
    "Explore Acme's source-owned object types, properties, links, and governed actions.",
  title: "Domain model",
}

export const Route = createFileRoute("/_app/develop/model")({
  ...pageOptions(page),
  component: ModelOverview,
})

function ModelOverview() {
  return (
    <div className="mx-auto w-full max-w-[90rem] px-5 py-10 lg:px-8 lg:py-14">
      <section className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight">
          Acme domain model
        </h1>
        <p className="mt-3 max-w-2xl leading-7 text-muted-foreground">
          This domain model is derived from the browser-safe company contract in
          @acme/api. It is a development projection, not a second source of
          business truth.
        </p>
      </section>

      <ModelExplorer model={AcmeModel} />
    </div>
  )
}
