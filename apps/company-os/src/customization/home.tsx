import { Button } from "@company/ui/components/button"
import { Skeleton } from "@company/ui/components/skeleton"
import { Link } from "@tanstack/react-router"
import { ArrowRightIcon } from "lucide-react"

import { applicationCapabilities } from "@/capabilities"
import { applicationConfig } from "@/customization/config"
import { useCapabilities } from "@/ui/application/use-capabilities"
import {
  modelNavigation,
  modelNavigationChecks,
} from "@/ui/model/model-navigation"

/** Source-owned workspace entry; destinations come from the installed modules. */
export function Home() {
  const capabilities = useCapabilities(modelNavigationChecks)
  const modules = modelNavigation
    .map((module) => ({
      ...module,
      items: module.items.filter((item) => capabilities.can(item.check)),
    }))
    .filter((module) => module.items.length > 0)
  const developer = useCapabilities([applicationCapabilities.develop])
  const canDevelop = developer.can(applicationCapabilities.develop)

  return (
    <div className="@container/main flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 lg:px-8">
        <header>
          <p className="text-sm font-medium text-muted-foreground">
            {applicationConfig.home.eyebrow}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {applicationConfig.home.headline}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            {applicationConfig.home.description}
          </p>
        </header>

        {capabilities.error !== undefined ? (
          <div
            role="alert"
            className="flex items-center justify-between gap-4 rounded-lg border p-4"
          >
            <p className="text-sm">Could not load your workspace access.</p>
            <Button variant="outline" size="sm" onClick={capabilities.refresh}>
              Retry
            </Button>
          </div>
        ) : capabilities.loading && modules.length === 0 ? (
          <section aria-label="Loading workspace">
            <output className="sr-only">Loading workspace…</output>
            <div
              aria-hidden="true"
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
            >
              {[0, 1, 2].map((index) => (
                <Skeleton key={index} className="h-28 rounded-lg" />
              ))}
            </div>
          </section>
        ) : modules.length === 0 ? (
          <div className="rounded-lg border p-5">
            <h2 className="text-sm font-medium">No workspace access yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Ask an administrator to assign a role for the work you need to do.
            </p>
          </div>
        ) : (
          modules.map((module) => (
            <section key={module.id} aria-labelledby={`module-${module.id}`}>
              <h2
                id={`module-${module.id}`}
                className="mb-3 text-sm font-medium"
              >
                {module.name}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {module.items.map((item) => (
                  <Link
                    key={item.object.id}
                    to={item.to}
                    className="group flex gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <item.icon
                      aria-hidden="true"
                      className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="flex items-center justify-between gap-2 text-sm font-medium">
                        {item.label}
                        <ArrowRightIcon
                          aria-hidden="true"
                          className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                        />
                      </h3>
                      {item.description && (
                        <p className="mt-1.5 text-sm leading-5 text-muted-foreground">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))
        )}

        {canDevelop && (
          <footer className="border-t pt-5">
            <Link
              to="/developer"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Developer Center
              <ArrowRightIcon aria-hidden="true" className="size-3.5" />
            </Link>
          </footer>
        )}
      </div>
    </div>
  )
}
