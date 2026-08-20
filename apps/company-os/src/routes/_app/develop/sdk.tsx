import { createFileRoute } from "@tanstack/react-router"

import { pageOptions } from "@/route-metadata"

const sdkExample = `import { AcmeModel } from "@acme/api"
import { createClient } from "@continual/runtime/client"

const acme = createClient(AcmeModel)
const companies = await acme.companies.list()`

const page = {
  breadcrumb: "SDK",
  description:
    "Use Acme from TypeScript with the model-inferred client or generate another client from the OpenAPI contract.",
  title: "SDK",
}

export const Route = createFileRoute("/_app/develop/sdk")({
  ...pageOptions(page),
  component: SdkPage,
})

function SdkPage() {
  return (
    <div className="mx-auto w-full max-w-[90rem] px-5 py-10 lg:px-8 lg:py-14">
      <section className="max-w-3xl">
        <p className="text-sm font-medium text-muted-foreground">Current</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Use Acme from TypeScript.
        </h1>
        <p className="mt-3 max-w-2xl leading-7 text-muted-foreground">
          The current client is inferred directly from Acme&apos;s source-owned
          domain model. It calls the same governed HTTP capabilities used by the
          Company OS application without introducing a second API definition.
        </p>
      </section>

      <section className="mt-12 grid gap-px border bg-border lg:grid-cols-2">
        <article className="bg-background p-6">
          <p className="text-xs font-medium text-muted-foreground">
            TypeScript
          </p>
          <h2 className="mt-8 text-lg font-medium">Model-inferred client</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Import the portable Acme model and the browser-safe runtime client
            directly inside this source workspace.
          </p>
          <pre className="mt-6 overflow-x-auto border bg-muted/50 p-4 text-xs leading-6">
            <code>{sdkExample}</code>
          </pre>
        </article>

        <article className="bg-background p-6">
          <p className="text-xs font-medium text-muted-foreground">
            Other languages
          </p>
          <h2 className="mt-8 text-lg font-medium">Generate from OpenAPI</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Acme publishes a runtime-derived OpenAPI 3.1 contract for consumers
            that cannot import the TypeScript model directly.
          </p>
          <a
            href="/api/openapi"
            className="mt-8 inline-flex text-xs font-medium hover:underline"
          >
            Open the OpenAPI JSON →
          </a>
        </article>
      </section>

      <section className="mt-8 border p-6">
        <p className="text-xs font-medium text-muted-foreground">Direction</p>
        <h2 className="mt-3 text-lg font-medium">
          Publish an Acme-specific package when an external consumer needs it.
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          A future package such as @acme/client can bind the model,
          authentication, and deployment URL behind a smaller import. Today that
          package does not exist; the source model and generic runtime client
          are the authoritative implementation.
        </p>
      </section>
    </div>
  )
}
