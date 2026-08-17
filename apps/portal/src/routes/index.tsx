import { Button } from "@acme/ui/components/button"
import { createFileRoute } from "@tanstack/react-router"

const projects = [
  { name: "Northwind rollout", status: "In progress" },
  { name: "Quarterly planning", status: "Waiting for review" },
] as const

export const Route = createFileRoute("/")({ component: PortalHome })

function PortalHome() {
  return (
    <main className="mx-auto min-h-svh max-w-6xl px-6 py-8 lg:px-8">
      <header className="flex items-center justify-between border-b pb-6">
        <div>
          <p className="font-medium">Acme</p>
          <p className="text-sm text-muted-foreground">Client portal</p>
        </div>
        <Button variant="outline" disabled>
          Sign in — coming next
        </Button>
      </header>

      <section className="py-12">
        <p className="text-sm font-medium text-muted-foreground">Projects</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Work with Acme
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Customers see the commitments, decisions, documents, and outcomes that
          Acme has deliberately shared with them.
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {projects.map((project) => (
            <article key={project.name} className="border bg-card p-5">
              <h2 className="font-medium">{project.name}</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {project.status}
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
