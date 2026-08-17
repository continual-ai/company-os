import { Button } from "@continual/ui/components/button"
import { createFileRoute, useRouter } from "@tanstack/react-router"

import { getRuntimeOverview } from "../lib/runtime"

export const Route = createFileRoute("/")({
  loader: () => getRuntimeOverview(),
  component: StudioHome,
})

function StudioHome() {
  const overview = Route.useLoaderData()
  const router = useRouter()
  const objectCount =
    overview.model?.modules.reduce(
      (total, module) => total + module.objects.length,
      0
    ) ?? 0

  return (
    <main className="min-h-svh">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <p className="font-semibold tracking-tight">Continual Studio</p>
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">
              {overview.runtimeUrl}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <span
                className={`size-2 rounded-full ${overview.connected ? "bg-emerald-600" : "bg-red-600"}`}
              />
              {overview.connected ? "Connected" : "Unavailable"}
            </span>
            <Button variant="outline" onClick={() => router.invalidate()}>
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-10">
        {overview.model ? (
          <>
            <section className="border-b pb-10">
              <p className="text-sm font-medium text-muted-foreground">
                Company Model
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                {overview.model.project.name}
              </h1>
              <p className="mt-3 text-sm text-muted-foreground">
                {overview.model.modules.length} modules · {objectCount} objects
                · description {overview.model.version}
              </p>
            </section>

            <div className="divide-y">
              {overview.model.modules.map((module) => (
                <section key={module.id} className="py-10">
                  <div className="grid gap-8 lg:grid-cols-[16rem_1fr]">
                    <div>
                      <h2 className="text-xl font-semibold">{module.name}</h2>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">
                        {module.id}
                      </p>
                    </div>
                    <div className="grid gap-4 xl:grid-cols-2">
                      {module.objects.map((object) => (
                        <article
                          key={object.id}
                          className="rounded-lg border bg-background p-5"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h3 className="font-semibold">{object.name}</h3>
                              <p className="mt-1 font-mono text-xs text-muted-foreground">
                                {object.id}
                              </p>
                            </div>
                            <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                              {Object.keys(object.fields).length} fields
                            </span>
                          </div>
                          {object.description ? (
                            <p className="mt-4 text-sm leading-6 text-muted-foreground">
                              {object.description}
                            </p>
                          ) : null}
                          <dl className="mt-5 divide-y border-t text-sm">
                            {Object.entries(object.fields).map(
                              ([fieldName, field]) => (
                                <div
                                  key={fieldName}
                                  className="grid grid-cols-[1fr_auto] gap-4 py-2.5"
                                >
                                  <dt className="font-mono text-xs">
                                    {fieldName}
                                  </dt>
                                  <dd className="text-xs text-muted-foreground">
                                    {field.kind}
                                    {field.required ? " · required" : ""}
                                  </dd>
                                </div>
                              )
                            )}
                          </dl>
                        </article>
                      ))}
                    </div>
                  </div>
                </section>
              ))}
            </div>
          </>
        ) : (
          <section className="max-w-2xl rounded-lg border bg-background p-6">
            <h1 className="text-xl font-semibold">Runtime unavailable</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Studio could not load the model from {overview.runtimeUrl}.
            </p>
            {overview.error ? (
              <pre className="mt-5 overflow-auto rounded-md bg-muted p-4 text-xs">
                {overview.error}
              </pre>
            ) : null}
          </section>
        )}
      </div>
    </main>
  )
}
