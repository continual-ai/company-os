import { Model } from "@company/model"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@company/ui/components/card"
import { Link } from "@tanstack/react-router"
import { ArrowRightIcon } from "lucide-react"

import { companyConfig } from "@/company/config"
import {
  companyObjectNavigation,
  companyObjectNavigationChecks,
} from "@/company/navigation"
import { useCapabilities } from "@/components/use-capabilities"

const modelObjectCount = Object.keys(Model.objects).length

/** Company-owned first authenticated experience and primary activation surface. */
export function CompanyHome() {
  const capabilities = useCapabilities(companyObjectNavigationChecks)
  const accessibleObjects = companyObjectNavigation.filter((item) =>
    capabilities.can({ permission: `${item.object.id}.list` })
  )

  return (
    <div className="@container/main flex flex-1 flex-col">
      <div className="flex flex-col gap-6 py-6 md:gap-8 md:py-8">
        <section className="px-4 lg:px-6">
          <p className="text-sm font-medium text-muted-foreground">
            {companyConfig.home.eyebrow}
          </p>
          <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight text-balance">
            {companyConfig.home.headline}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            {companyConfig.home.description}
          </p>
        </section>

        {capabilities.loading ? null : (
          <section className="grid grid-cols-1 gap-4 px-4 sm:grid-cols-2 lg:px-6 @4xl/main:grid-cols-4">
            {accessibleObjects.length === 0 ? (
              <div className="border bg-muted/20 p-4 sm:col-span-2 @4xl/main:col-span-4">
                <p className="text-sm font-medium">
                  No operations assigned yet
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Operating surfaces will appear here when this identity
                  receives access.
                </p>
              </div>
            ) : (
              accessibleObjects.slice(0, 4).map((item) => (
                <Link key={item.to} to={item.to} className="block">
                  <Card
                    size="sm"
                    className="h-full transition-colors hover:bg-muted/30"
                  >
                    <CardHeader>
                      <div className="mb-4 flex size-8 items-center justify-center bg-muted text-muted-foreground">
                        <item.icon className="size-4" />
                      </div>
                      <CardTitle>{item.object.pluralName}</CardTitle>
                      <CardDescription>
                        {item.object.description}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              ))
            )}
          </section>
        )}

        <section className="grid gap-px border-y bg-border lg:grid-cols-2">
          <article className="bg-background px-4 py-6 lg:px-6 lg:py-8">
            <p className="text-xs font-medium text-muted-foreground">
              Shared foundation
            </p>
            <h2 className="mt-8 text-lg font-medium">
              One operating model, not another isolated tool.
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              {modelObjectCount} typed objects currently share identity,
              authorization, persistence, and governed interfaces. New workflows
              can build on the same business meaning.
            </p>
          </article>

          <Link
            to="/develop"
            className="group bg-background px-4 py-6 transition-colors hover:bg-muted/30 lg:px-6 lg:py-8"
          >
            <p className="text-xs font-medium text-muted-foreground">
              Build from here
            </p>
            <h2 className="mt-8 flex items-center gap-2 text-lg font-medium">
              Understand and extend the system
              <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-1 motion-reduce:transition-none" />
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              Explore the model, generated API, SDK, MCP projection, and
              source-owned design system behind this first operation.
            </p>
          </Link>
        </section>
      </div>
    </div>
  )
}
