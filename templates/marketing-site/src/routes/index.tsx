import { modelMetadata } from "@company/model/metadata"
import { buttonVariants } from "@company/ui/components/button"
import { cn } from "@company/ui/lib/utils"
import { createFileRoute } from "@tanstack/react-router"
import { ArrowRight, Building2, FolderKanban, Users } from "lucide-react"

import { SiteShell } from "@/components/site-shell"
import { clientPortalUrl, companyOsUrl } from "@/lib/app-urls"

const capabilities = [
  {
    title: "Customers",
    description:
      "Keep the organizations and people you serve connected to every commitment.",
    icon: Building2,
  },
  {
    title: "Projects",
    description:
      "Move work from inquiry to active delivery without losing context at the handoff.",
    icon: FolderKanban,
  },
  {
    title: "Shared work",
    description:
      "Give customers, operators, and agents one governed source of truth.",
    icon: Users,
  },
] as const

export const Route = createFileRoute("/")({
  component: MarketingSiteHome,
})

function MarketingSiteHome() {
  return (
    <SiteShell>
      <main>
        <section className="border-b">
          <div className="mx-auto grid min-h-[38rem] max-w-6xl items-center gap-12 px-6 py-20 lg:grid-cols-[1.3fr_0.7fr]">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {modelMetadata.name}
              </p>
              <h1 className="mt-5 max-w-3xl text-5xl leading-[1.02] font-semibold tracking-[-0.05em] text-balance sm:text-7xl">
                Complex work, run as one system.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
                {modelMetadata.name} connects customer context, project
                delivery, and the work that needs attention so every team
                operates from the same system.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href={clientPortalUrl}
                  className={cn(buttonVariants({ size: "lg" }))}
                >
                  Open client portal
                  <ArrowRight data-icon="inline-end" />
                </a>
                <a
                  href={companyOsUrl}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "lg" })
                  )}
                >
                  Open Company OS
                </a>
              </div>
            </div>
            <aside className="border bg-card p-6 shadow-sm">
              <p className="text-sm font-medium">Today</p>
              <div className="mt-6 space-y-3">
                {[
                  ["New inquiry", "Needs qualification"],
                  ["Northwind rollout", "Customer review"],
                  ["Renewal planning", "On track"],
                ].map(([title, status]) => (
                  <div
                    key={title}
                    className="flex items-center justify-between gap-4 border p-4"
                  >
                    <p className="text-sm font-medium">{title}</p>
                    <p className="text-xs text-muted-foreground">{status}</p>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-20">
          <p className="text-sm font-medium text-muted-foreground">
            One operating model
          </p>
          <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            The same business meaning behind every interface.
          </h2>
          <div className="mt-10 grid border-t md:grid-cols-3">
            {capabilities.map((capability) => (
              <article
                key={capability.title}
                className="border-b py-7 md:border-r md:px-7 md:first:pl-0 md:last:border-r-0 md:last:pr-0"
              >
                <capability.icon className="size-5 text-muted-foreground" />
                <h3 className="mt-5 font-semibold">{capability.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {capability.description}
                </p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </SiteShell>
  )
}
