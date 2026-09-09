import { createFileRoute } from "@tanstack/react-router"
import { appMetadata } from "company-os/config"
import { Model } from "company-os/model"

import { listPeople } from "#/company-os.functions.ts"

export const Route = createFileRoute("/")({
  loader: () => listPeople(),
  component: Home,
})

const objectNames = Object.values(Model.objects)
  .map((object) => object.pluralName)
  .sort()

function Home() {
  const { people, total, error } = Route.useLoaderData()
  return (
    <main className="grid min-h-svh place-items-center px-6">
      <div className="w-full max-w-md space-y-8">
        <header className="text-center">
          <p className="text-sm font-medium text-muted-foreground">
            {appMetadata.name}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            A new application
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Replace this page with the app&apos;s first real surface. Durable
            records, rules, and authorization stay in the central app.
          </p>
        </header>
        <section className="rounded-lg border p-5 text-sm">
          <h2 className="font-medium">People</h2>
          {error ? (
            <p className="mt-2 text-muted-foreground">
              The central app did not answer as this user: {error}
            </p>
          ) : (
            <ul className="mt-2 space-y-1">
              {people.map((person) => (
                <li key={person.id}>{person.name}</li>
              ))}
              {total > people.length && (
                <li className="text-muted-foreground">
                  and {total - people.length} more
                </li>
              )}
            </ul>
          )}
        </section>
        <p className="text-center text-xs text-muted-foreground">
          This deployment exposes {objectNames.join(", ")}.
        </p>
      </div>
    </main>
  )
}
