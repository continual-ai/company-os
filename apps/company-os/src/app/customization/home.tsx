import { Link } from "@tanstack/react-router"
import { ArrowRightIcon } from "lucide-react"

import { appConfig } from "#/app/customization/config.ts"
import { applicationCapabilities } from "#/runtime/client/capabilities.ts"
import { Button } from "#/runtime/ui/components/button.tsx"
import { Skeleton } from "#/runtime/ui/components/skeleton.tsx"
import { useModelNavigation } from "#/runtime/ui/model/module-navigation.tsx"
import { ObjectRecordSummary } from "#/runtime/ui/model/object-record-summary.tsx"
import { useRecentRecords } from "#/runtime/ui/model/recent-records.tsx"
import { useCapabilities } from "#/runtime/ui/model/use-capabilities.ts"

/** Source-owned workspace entry; destinations come from the installed modules. */
export function Home() {
  const recent = useRecentRecords()
  const { modules: modelNavigation, checks } = useModelNavigation()
  const capabilities = useCapabilities(checks)
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
            {appConfig.home.eyebrow}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {appConfig.home.headline}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            {appConfig.home.description}
          </p>
        </header>

        <section aria-labelledby="recent-records">
          <h2 id="recent-records" className="mb-3 text-sm font-semibold">
            Recently opened
          </h2>
          {recent.length > 0 ? (
            <ul className="divide-y rounded-lg border">
              {recent.map(({ object, record }) => (
                <li
                  key={record.id}
                  className="flex items-center gap-4 px-4 py-3"
                >
                  <ObjectRecordSummary
                    object={object}
                    record={record}
                    variant="preview"
                  />
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {object.name}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Records you open appear here for this session.
            </p>
          )}
        </section>

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
              className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3"
            >
              {[0, 1, 2].map((index) => (
                <Skeleton key={index} className="h-28 rounded-lg" />
              ))}
            </div>
          </section>
        ) : modules.length === 0 ? (
          <div className="rounded-lg border p-5">
            <h2 className="text-sm font-medium">
              {modelNavigation.length === 0
                ? "Your workspace is ready"
                : "No workspace access yet"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {modelNavigation.length === 0
                ? "Collections will appear here when they’re added."
                : "Ask an administrator to assign a role for the work you need to do."}
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
              <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                {module.items.map((item) => (
                  <Link
                    key={item.object.id}
                    to={item.to}
                    className="group flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <item.icon
                      aria-hidden="true"
                      className="size-4 shrink-0 text-muted-foreground"
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="flex items-center justify-between gap-2 text-sm font-medium">
                        {item.label}
                        <ArrowRightIcon
                          aria-hidden="true"
                          className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                        />
                      </h3>
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
