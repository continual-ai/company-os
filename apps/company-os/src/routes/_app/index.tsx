import { Model } from "@company/model"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@company/ui/components/card"
import { Link, createFileRoute } from "@tanstack/react-router"

import { pageOptions } from "@/route-metadata"

const model = Object.values(Model.objects).map((object) => ({
  name: object.pluralName,
  description: object.description,
}))

const crm = [
  {
    label: "Companies",
    to: "/companies",
    description: Model.objects.company.description,
  },
  {
    label: "Contacts",
    to: "/contacts",
    description: Model.objects.contact.description,
  },
  { label: "Leads", to: "/leads", description: Model.objects.lead.description },
  { label: "Deals", to: "/deals", description: Model.objects.deal.description },
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
          {crm.map((item) => (
            <Link key={item.to} to={item.to} className="block">
              <Card
                size="sm"
                className="h-full transition-colors hover:bg-muted/30"
              >
                <CardHeader>
                  <CardTitle>{item.label}</CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </section>

        <section className="px-4 lg:px-6">
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
        </section>
      </div>
    </div>
  )
}
