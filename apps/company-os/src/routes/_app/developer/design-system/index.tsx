import { Link, createFileRoute } from "@tanstack/react-router"
import { ArrowRightIcon } from "lucide-react"

import { componentGroups } from "@/ui/developer/design-system/component-metadata"

export const Route = createFileRoute("/_app/developer/design-system/")({
  component: DesignSystemOverview,
})

function DesignSystemOverview() {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-10 lg:px-12 lg:py-14">
      <header className="max-w-3xl">
        <p className="text-xs font-medium text-muted-foreground">
          Company-owned interface
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
          The interface this system operates through.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
          A curated mechanical layer keeps applications coherent. Opinionated
          patterns earn a shared contract through real product use.
        </p>
      </header>

      <section className="mt-14 grid gap-px border bg-border md:grid-cols-2">
        <article className="bg-background p-6">
          <p className="text-xs font-medium text-muted-foreground">Current</p>
          <h2 className="mt-8 text-lg font-medium">Components</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            Source-owned shadcn mechanics, curated and styled in @company/ui for
            consistent interaction, accessibility, and visual language.
          </p>
        </article>
        <article className="bg-background p-6">
          <p className="text-xs font-medium text-muted-foreground">Direction</p>
          <h2 className="mt-8 text-lg font-medium">Product patterns</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            Higher-level compositions begin with the app that needs them. A
            pattern moves into @company/ui only when its semantics hold across
            concrete consumers.
          </p>
        </article>
      </section>

      <section className="mt-16">
        <div className="grid gap-4 border-t pt-6 lg:grid-cols-[12rem_minmax(0,1fr)]">
          <p className="text-xs font-medium text-muted-foreground">
            Foundation
          </p>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              A semantic visual language
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              Tokens establish the shared color, type, density, and surface
              vocabulary beneath every component.
            </p>
            <Link
              to="/developer/design-system/foundations"
              className="mt-5 inline-flex items-center gap-1.5 text-xs font-medium hover:underline"
            >
              Explore foundations <ArrowRightIcon className="size-3.5" />
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-16">
        <div className="border-t pt-6">
          <p className="text-xs font-medium text-muted-foreground">
            Components
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">
            Current public surface
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Each page shows the live component, a canonical usage example, and
            the exact public import path.
          </p>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          {componentGroups.map((group) => (
            <div key={group.label}>
              <h3 className="text-xs font-medium text-muted-foreground">
                {group.label}
              </h3>
              <div className="mt-3 divide-y border-y">
                {group.components.map((component) => (
                  <Link
                    key={component.slug}
                    to="/developer/design-system/components/$componentId"
                    params={{ componentId: component.slug }}
                    className="group flex items-start justify-between gap-4 py-3 text-sm"
                  >
                    <span>
                      <span className="font-medium group-hover:underline">
                        {component.name}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                        {component.description}
                      </span>
                    </span>
                    <ArrowRightIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16 border-t pt-6">
        <div className="grid gap-8 md:grid-cols-3">
          <Principle
            number="01"
            title="Compose first"
            description="Use the component layer directly while the product shape is still becoming clear."
          />
          <Principle
            number="02"
            title="Name the meaning"
            description="Standardize a pattern only when its name communicates durable product semantics."
          />
          <Principle
            number="03"
            title="Promote through use"
            description="Move a pattern into the shared package after concrete consumers prove the boundary."
          />
        </div>
      </section>
    </div>
  )
}

function Principle({
  number,
  title,
  description,
}: {
  number: string
  title: string
  description: string
}) {
  return (
    <article>
      <p className="text-xs text-muted-foreground">{number}</p>
      <h3 className="mt-6 font-medium">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {description}
      </p>
    </article>
  )
}
