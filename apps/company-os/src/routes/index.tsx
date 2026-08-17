import { Button } from "@acme/ui/components/button"
import { createFileRoute } from "@tanstack/react-router"

const model = [
  {
    name: "Customers",
    description: "Organizations Acme serves or is preparing to serve",
  },
  {
    name: "Contacts",
    description: "People connected to customers and projects",
  },
  {
    name: "Projects",
    description: "Inquiries, proposals, active delivery, and outcomes",
  },
] as const

const work = [
  "Qualify the new Northwind inquiry",
  "Review the rollout plan",
  "Confirm the quarterly outcome",
] as const

export const Route = createFileRoute("/")({ component: CompanyOsHome })

function CompanyOsHome() {
  return (
    <main className="mx-auto min-h-svh max-w-7xl px-6 py-8 lg:px-8">
      <header className="flex items-center justify-between border-b pb-6">
        <div>
          <p className="font-medium">Acme</p>
          <p className="text-sm text-muted-foreground">Company OS</p>
        </div>
        <Button variant="outline" disabled>
          Sign in — coming next
        </Button>
      </header>

      <section className="grid gap-12 py-12 lg:grid-cols-[1fr_24rem]">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Operating model
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Run the work from shared business context.
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            These surfaces will use the same typed definitions and governed
            capabilities exposed through the runtime API and MCP.
          </p>
          <div className="mt-10 grid border-t sm:grid-cols-3">
            {model.map((object) => (
              <article
                key={object.name}
                className="border-b p-6 sm:border-r sm:first:pl-0"
              >
                <h2 className="font-medium">{object.name}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {object.description}
                </p>
              </article>
            ))}
          </div>
        </div>
        <aside className="border bg-card p-6">
          <p className="font-medium">Needs attention</p>
          <div className="mt-5 divide-y border-y">
            {work.map((item) => (
              <p key={item} className="py-4 text-sm">
                {item}
              </p>
            ))}
          </div>
        </aside>
      </section>
    </main>
  )
}
