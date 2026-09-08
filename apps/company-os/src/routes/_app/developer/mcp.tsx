import { CodeBlock } from "@company/ui/components/code-block"
import { Link, createFileRoute } from "@tanstack/react-router"

import { pageOptions } from "#/route-metadata.ts"

const page = {
  breadcrumb: "MCP",
  description:
    "Connect assistants to the same governed queries and actions as the application.",
  title: "MCP",
}

export const Route = createFileRoute("/_app/developer/mcp")({
  ...pageOptions(page),
  component: McpPage,
})

function McpPage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-5 py-8 lg:px-8 lg:py-12">
      <header className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight">
          Give agents governed tools.
        </h1>
        <p className="mt-3 leading-7 text-muted-foreground">
          The MCP server exposes the model’s queries, actions, and relationship
          operations. Agents use the same authorization, validation,
          transactions, and durable events as people using the app.
        </p>
      </header>
      <section className="space-y-4">
        <h2 className="text-lg font-medium">Connect over Streamable HTTP</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Add your deployment’s origin followed by <code>/api/mcp</code> to a
          compatible MCP client. Configure credentials accepted by that
          deployment’s identity provider. A browser login alone does not
          authenticate an external agent; the app does not issue a separate MCP
          credential.
        </p>
        <CodeBlock
          label="Endpoint path · prepend your deployment origin"
          code="/api/mcp"
        />
      </section>
      <section className="grid gap-6 md:grid-cols-2">
        <article className="min-w-0 space-y-4">
          <h2 className="text-lg font-medium">Discover available tools</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            After the MCP initialization handshake, request the live catalog
            with
            <code> tools/list</code>. Each tool includes its input schema and
            annotations identifying read-only or destructive behavior.
          </p>
          <CodeBlock
            language="json"
            label="MCP request"
            code={JSON.stringify(
              { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} },
              null,
              2
            )}
          />
        </article>
        <article className="min-w-0 space-y-4">
          <h2 className="text-lg font-medium">Call a model operation</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Tool names follow <code>object.operation</code> and
            <code> object.relationship.operation</code>. Discoverability does
            not grant access: each call checks the agent’s effective
            permissions.
          </p>
          <CodeBlock
            language="json"
            label="List companies"
            code={JSON.stringify(
              {
                jsonrpc: "2.0",
                id: 2,
                method: "tools/call",
                params: { name: "company.list", arguments: { pageSize: 20 } },
              },
              null,
              2
            )}
          />
        </article>
      </section>
      <section className="rounded-lg border p-5 sm:p-6">
        <h2 className="text-lg font-medium">
          Choose an agent’s authority deliberately
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Use a dedicated identity and grant only the required operations and
          scopes. Model actions enforce business rules; an MCP connection does
          not create a background worker or schedule an agent. Your agent
          runtime owns execution and retries.
        </p>
      </section>
      <footer className="flex flex-wrap gap-6 text-sm">
        <Link to="/developer/model" className="underline underline-offset-4">
          Explore objects and actions
        </Link>
        <Link to="/developer/api" className="underline underline-offset-4">
          Inspect API schemas
        </Link>
      </footer>
    </div>
  )
}
