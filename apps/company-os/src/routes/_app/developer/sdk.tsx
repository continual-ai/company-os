import { Link, createFileRoute } from "@tanstack/react-router"

import { pageOptions } from "@/route-metadata"
import { DeveloperCodeBlock } from "@/ui/developer/developer-browser"

const queryExample = `import { useQuery } from "@tanstack/react-query"
import { data } from "@/app-client"

const companies = data.company.list({ pageSize: 50 })

// In a TanStack Router loader:
// await context.queryClient.ensureQueryData(companies)

export function CompanyNames() {
  const query = useQuery(companies)
  if (query.isPending) return <p>Loading companies…</p>
  if (query.isError) return <p>{query.error.message}</p>
  return <ul>{query.data.items.map(company => (
    <li key={company.id}>{company.name}</li>
  ))}</ul>
}`

const mutationExample = `import { useMutation } from "@tanstack/react-query"
import { data } from "@/app-client"

// Inside a React component:
const update = useMutation(data.company.update())

// On form submission, use the revision the user edited:
await update.mutateAsync({
  id: company.id,
  etag: company.etag,
  name: values.name,
})
// Render update.error through the shared form error boundary.
// The server reports affected objects; the cache updates automatically.`

const page = {
  breadcrumb: "TypeScript",
  description:
    "Read, mutate, and extend the application through its model-derived client.",
  title: "TypeScript",
}

export const Route = createFileRoute("/_app/developer/sdk")({
  ...pageOptions(page),
  component: SdkPage,
})

function SdkPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-5 py-8 lg:px-8 lg:py-12">
      <header className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight">
          Build with the model.
        </h1>
        <p className="mt-3 leading-7 text-muted-foreground">
          Import <code>data</code> from <code>@/app-client</code>. Reads return
          TanStack Query options; writes return mutation options. React and
          Router share one cache and the same typed contracts as the API.
        </p>
      </header>
      <section className="grid gap-6 xl:grid-cols-2">
        <article className="min-w-0 space-y-4">
          <h2 className="text-lg font-medium">Read and preload</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Preload the screen’s exact request in its loader. Components observe
            that same query, keep cached data during revalidation, and receive
            committed changes from the authorized event feed.
          </p>
          <DeveloperCodeBlock label="A collection query" code={queryExample} />
        </article>
        <article className="min-w-0 space-y-4">
          <h2 className="text-lg font-medium">Mutate safely</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Updates carry an etag to prevent overwriting another person’s or
            agent’s changes. Forms keep unsaved drafts locally. Authorization,
            validation, and business rules run on the server for every caller.
          </p>
          <DeveloperCodeBlock
            label="An update mutation"
            code={mutationExample}
          />
        </article>
      </section>
      <section className="border p-5 sm:p-6">
        <h2 className="text-lg font-medium">Where to put new functionality</h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-[minmax(0,1fr)_2fr]">
          <dt className="font-mono break-words">
            src/modules/&lt;domain&gt;/&lt;object&gt;/model.ts
          </dt>
          <dd className="text-muted-foreground">
            Define fields, relationships, Queries, and Actions. Standard CRUD
            and contracts derive from this model.
          </dd>
          <dt className="font-mono">&lt;object&gt;/server/</dt>
          <dd className="text-muted-foreground">
            Implement named Effect functions for custom operations. Keep
            operation-specific SQL beside the operation.
          </dd>
          <dt className="font-mono">&lt;object&gt;/ui/config.ts</dt>
          <dd className="text-muted-foreground">
            Register views, action buttons, record tabs, or field editors. Put
            their React components alongside the configuration.
          </dd>
          <dt className="font-mono">docs/modules.md</dt>
          <dd className="text-muted-foreground">
            Follow the complete authoring guide in your checkout. Distinct
            workflows use ordinary React pages and TanStack routes.
          </dd>
        </dl>
      </section>
      <footer className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
        <Link to="/developer/model" className="underline underline-offset-4">
          Explore the model
        </Link>
        <Link to="/developer/api" className="underline underline-offset-4">
          API reference
        </Link>
        <a href="/api/openapi" className="underline underline-offset-4">
          Download OpenAPI JSON
        </a>
      </footer>
    </div>
  )
}
