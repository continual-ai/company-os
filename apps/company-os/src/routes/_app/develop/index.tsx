import { Link, createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/_app/develop/")({
  component: DevelopOverview,
})

function DevelopOverview() {
  return (
    <div className="mx-auto w-full max-w-[90rem] px-5 py-10 lg:px-8 lg:py-14">
      <section className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight">
          Understand and extend the company system.
        </h1>
        <p className="mt-3 max-w-2xl leading-7 text-muted-foreground">
          Inspect the company domain model and its generated interfaces, then
          build new company software against the same source-owned contracts.
        </p>
      </section>

      <section className="mt-12 grid gap-px border bg-border md:grid-cols-2 xl:grid-cols-3">
        <DeveloperSurface
          eyebrow="Model"
          title="Domain model"
          description="Explore Acme's object types, properties, link types, and governed action types."
          to="/develop/model"
        />
        <DeveloperSurface
          eyebrow="API"
          title="API reference"
          description="Explore the OpenAPI contract generated from the same domain model used by the runtime."
          href="/api/docs"
        />
        <DeveloperSurface
          eyebrow="TypeScript"
          title="SDK"
          description="Use the model-inferred client from source or generate another client from Acme's OpenAPI contract."
          to="/develop/sdk"
        />
        <DeveloperSurface
          eyebrow="Assistants"
          title="MCP"
          description="Connect Claude, ChatGPT, Cursor, and other MCP clients to governed Company OS capabilities."
          to="/develop/mcp"
        />
        <DeveloperSurface
          eyebrow="Interface"
          title="Design system"
          description="Develop and verify the foundations, components, and operating patterns used across Acme apps."
          to="/develop/design-system"
        />
        <DeveloperSurface
          eyebrow="Data"
          title="Data explorer"
          description="Governed views over company records belong here as concrete operational needs establish them."
        />
      </section>
    </div>
  )
}

function DeveloperSurface({
  eyebrow,
  title,
  description,
  to,
  href,
}: {
  eyebrow: string
  title: string
  description: string
  to?:
    | "/develop/model"
    | "/develop/sdk"
    | "/develop/mcp"
    | "/develop/design-system"
  href?: string
}) {
  const content = (
    <>
      <p className="text-xs font-medium text-muted-foreground">{eyebrow}</p>
      <h2 className="mt-8 font-medium">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      <p className="mt-8 text-xs font-medium">
        {to || href ? "Open surface →" : "Add when a real slice needs it"}
      </p>
    </>
  )

  if (to) {
    return (
      <Link to={to} className="bg-background p-6 hover:bg-muted/50">
        {content}
      </Link>
    )
  }

  if (href) {
    return (
      <a href={href} className="bg-background p-6 hover:bg-muted/50">
        {content}
      </a>
    )
  }

  return <article className="bg-background p-6">{content}</article>
}
