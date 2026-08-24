import { createFileRoute } from "@tanstack/react-router"

import { pageOptions } from "@/route-metadata"

const consumers = ["Claude", "ChatGPT", "Cursor", "Other MCP clients"] as const

const page = {
  breadcrumb: "MCP",
  description:
    "Connect assistants through an MCP projection of the same governed capabilities.",
  title: "MCP",
}

export const Route = createFileRoute("/_app/develop/mcp")({
  ...pageOptions(page),
  component: McpPage,
})

function McpPage() {
  return (
    <div className="mx-auto w-full max-w-[90rem] px-5 py-10 lg:px-8 lg:py-14">
      <section className="max-w-3xl">
        <p className="text-sm font-medium text-muted-foreground">Direction</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Connect assistants through MCP.
        </h1>
        <p className="mt-3 max-w-2xl leading-7 text-muted-foreground">
          MCP should project the same governed capabilities used by people and
          applications so assistants can inspect business context and take
          authorized actions without becoming a second implementation.
        </p>
      </section>

      <section className="mt-12 grid gap-px border bg-border lg:grid-cols-2">
        <article className="bg-background p-6">
          <p className="text-xs font-medium text-muted-foreground">
            Connection status
          </p>
          <h2 className="mt-8 text-lg font-medium">Not exposed yet</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            This repository does not currently publish an MCP endpoint. The
            connection URL and client configuration belong here once identity,
            authorization, and the tool projection are implemented.
          </p>
        </article>

        <article className="bg-background p-6">
          <p className="text-xs font-medium text-muted-foreground">Connect</p>
          <h2 className="mt-8 text-lg font-medium">MCP clients</h2>
          <div className="mt-4 divide-y border-y">
            {consumers.map((consumer) => (
              <p key={consumer} className="py-3 text-sm">
                {consumer}
              </p>
            ))}
          </div>
        </article>
      </section>

      <section className="mt-8 border p-6">
        <p className="text-xs font-medium text-muted-foreground">
          Required boundary
        </p>
        <h2 className="mt-3 text-lg font-medium">
          One governed capability surface, another protocol projection.
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          The MCP server should establish the actor, enforce the same company
          authorization as HTTP and internal interfaces, derive tools from real
          capabilities, and preserve audit context. It should not implement
          business behavior independently.
        </p>
      </section>
    </div>
  )
}
