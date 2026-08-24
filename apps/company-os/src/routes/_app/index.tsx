import { Model } from "@company/model"
import { Button } from "@company/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@company/ui/components/card"
import { createFileRoute } from "@tanstack/react-router"

import { operatingTasks } from "@/operate-data"
import { pageOptions } from "@/route-metadata"

const model = Object.values(Model.objects).map((object) => ({
  name: object.pluralName,
  description: object.description,
}))

const summaries = [
  {
    label: "Business object types",
    value: model.length,
    description: "Shared typed definitions",
  },
  {
    label: "Needs attention",
    value: operatingTasks.length,
    description: "Items in the operating queue",
  },
  {
    label: "Developer surfaces",
    value: 3,
    description: "Domain model, API, and design system",
  },
  {
    label: "Knowledge collections",
    value: 3,
    description: "Company, playbooks, and ways of working",
  },
] as const

const page = {
  breadcrumb: "Home",
  description:
    "Run work from shared business context used by people, applications, integrations, and agents.",
  title: "Home",
}

export const Route = createFileRoute("/_app/")({
  ...pageOptions(page),
  component: OperateHome,
})

function OperateHome() {
  return (
    <div className="@container/main flex flex-1 flex-col">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <section className="px-4 lg:px-6">
          <p className="text-sm font-medium text-muted-foreground">
            Operating overview
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Run the work from shared business context.
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            The same typed definitions and governed capabilities serve people,
            applications, integrations, and agents.
          </p>
        </section>

        <section className="grid grid-cols-1 gap-4 px-4 sm:grid-cols-2 lg:px-6 @4xl/main:grid-cols-4">
          {summaries.map((summary) => (
            <Card key={summary.label} size="sm">
              <CardHeader>
                <CardDescription>{summary.label}</CardDescription>
                <CardTitle className="text-2xl tabular-nums">
                  {summary.value}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {summary.description}
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="grid gap-4 px-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:px-6">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Operating model</CardTitle>
              <CardDescription>
                Business objects projected from @company/model
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-px bg-border p-0 sm:grid-cols-2 xl:grid-cols-4">
              {model.map((object) => (
                <article key={object.name} className="bg-card p-4">
                  <h2 className="text-sm font-medium">{object.name}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {object.description}
                  </p>
                </article>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle>Needs attention</CardTitle>
              <CardDescription>Current operating queue</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {operatingTasks.map((item) => (
                  <p key={item} className="px-4 py-3 text-sm">
                    {item}
                  </p>
                ))}
              </div>
              <div className="border-t p-4">
                <Button className="w-full" disabled>
                  Open work queue — coming next
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  )
}
