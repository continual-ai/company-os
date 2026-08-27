import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@company/ui/components/card"
import { Link } from "@tanstack/react-router"
import { ArrowRightIcon } from "lucide-react"

import { applicationCapabilities, capabilityPermission } from "@/capabilities"
import { applicationConfig } from "@/customization/config"
import {
  salesNavigation,
  salesNavigationChecks,
} from "@/customization/navigation"
import { useCapabilities } from "@/ui/application/use-capabilities"

const homeCapabilityChecks = [
  ...salesNavigationChecks,
  applicationCapabilities.develop,
]
const homeObjectIds = new Set(["lead", "company", "deal", "interaction"])

/** Custom first authenticated experience and primary activation surface. */
export function Home() {
  const capabilities = useCapabilities(homeCapabilityChecks)
  const accessibleDestinations = salesNavigation.filter(
    (item) =>
      homeObjectIds.has(item.object.id) &&
      capabilities.can({
        permission: capabilityPermission(`${item.object.id}.list`),
      })
  )
  const canDevelop = capabilities.can(applicationCapabilities.develop)

  return (
    <div className="@container/main flex flex-1 flex-col">
      <div className="flex flex-col gap-6 py-6 md:gap-8 md:py-8">
        <section className="px-4 lg:px-6">
          <p className="text-sm font-medium text-muted-foreground">
            {applicationConfig.home.eyebrow}
          </p>
          <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight text-balance">
            {applicationConfig.home.headline}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            {applicationConfig.home.description}
          </p>
        </section>

        {capabilities.loading ? null : (
          <section className="grid grid-cols-1 gap-4 px-4 sm:grid-cols-2 lg:px-6 @4xl/main:grid-cols-4">
            {accessibleDestinations.length === 0 ? (
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
              accessibleDestinations.map((item) => (
                <Link key={item.to} to={item.to} className="block">
                  <Card
                    size="sm"
                    className="h-full transition-colors hover:bg-muted/30"
                  >
                    <CardHeader>
                      <div className="mb-4 flex size-8 items-center justify-center bg-muted text-muted-foreground">
                        <item.icon className="size-4" />
                      </div>
                      <CardTitle>{item.label}</CardTitle>
                      <CardDescription>{item.description}</CardDescription>
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
              How work moves
            </p>
            <h2 className="mt-8 text-lg font-medium">
              Keep the whole sales relationship connected.
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              Qualify a lead into a company and contact, advance the resulting
              deal, and keep every interaction attached to the same business
              context.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {["Lead", "Company + contact", "Deal", "Activity"].map(
                (step, index) => (
                  <span key={step} className="contents">
                    {index === 0 ? null : <ArrowRightIcon className="size-3" />}
                    <span className="border bg-muted/20 px-2 py-1 text-foreground">
                      {step}
                    </span>
                  </span>
                )
              )}
            </div>
          </article>

          {canDevelop ? (
            <Link
              to="/develop"
              className="group bg-background px-4 py-6 transition-colors hover:bg-muted/30 lg:px-6 lg:py-8"
            >
              <p className="text-xs font-medium text-muted-foreground">
                Develop this operation
              </p>
              <h2 className="mt-8 flex items-center gap-2 text-lg font-medium">
                Inspect and extend the system
                <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-1 motion-reduce:transition-none" />
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                Use the model, API, SDK, MCP projection, and interface patterns
                behind the sales workflow.
              </p>
            </Link>
          ) : (
            <article className="bg-background px-4 py-6 lg:px-6 lg:py-8">
              <p className="text-xs font-medium text-muted-foreground">
                Shared context
              </p>
              <h2 className="mt-8 text-lg font-medium">
                Work from one current customer record.
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                Companies, contacts, opportunities, and activity stay connected
                as the relationship changes.
              </p>
            </article>
          )}
        </section>
      </div>
    </div>
  )
}
