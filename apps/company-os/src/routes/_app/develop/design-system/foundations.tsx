import { createFileRoute } from "@tanstack/react-router"

import { pageOptions } from "@/route-metadata"

const page = {
  breadcrumb: "Foundations",
  description:
    "Explore the system's semantic color, typography, density, and surface foundations.",
  title: "Foundations",
}

const colors = [
  { name: "Background", className: "bg-background", border: true },
  { name: "Card", className: "bg-card", border: true },
  {
    name: "Primary",
    className: "bg-primary text-primary-foreground",
    border: false,
  },
  {
    name: "Secondary",
    className: "bg-secondary text-secondary-foreground",
    border: false,
  },
  {
    name: "Muted",
    className: "bg-muted text-muted-foreground",
    border: false,
  },
  {
    name: "Accent",
    className: "bg-accent text-accent-foreground",
    border: false,
  },
  {
    name: "Destructive",
    className: "bg-destructive text-white dark:text-foreground",
    border: false,
  },
] as const

export const Route = createFileRoute("/_app/develop/design-system/foundations")(
  {
    ...pageOptions(page),
    component: FoundationsPage,
  }
)

function FoundationsPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-10 lg:px-12 lg:py-14">
      <header className="max-w-3xl">
        <p className="text-xs font-medium text-muted-foreground">Foundations</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          A semantic visual language
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          Tokens communicate purpose across interfaces without tying the visual
          system to a particular page or business object.
        </p>
      </header>

      <section className="mt-14 border-t pt-6">
        <h2 className="text-lg font-medium">Color</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Components consume semantic surface and state tokens rather than
          hard-coded palette values.
        </p>
        <div className="mt-8 grid gap-px border bg-border sm:grid-cols-2 xl:grid-cols-4">
          {colors.map((color) => (
            <div key={color.name} className="bg-background p-3">
              <div
                className={`h-24 p-3 text-xs font-medium ${color.className} ${color.border ? "border" : ""}`}
              >
                {color.name}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-14 grid gap-8 border-t pt-6 lg:grid-cols-[12rem_minmax(0,1fr)]">
        <div>
          <h2 className="text-xs font-medium">Typography</h2>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Geist supports compact operating surfaces and readable guidance.
          </p>
        </div>
        <div className="space-y-5">
          <p className="text-4xl font-semibold tracking-tight">
            Company heading
          </p>
          <p className="text-2xl font-semibold tracking-tight">
            Section heading
          </p>
          <p className="text-base leading-7">
            Body copy explains the state of the business and the work that needs
            to happen next.
          </p>
          <p className="text-xs text-muted-foreground">
            Supporting metadata · Updated moments ago
          </p>
        </div>
      </section>

      <section className="mt-14 grid gap-8 border-t pt-6 lg:grid-cols-[12rem_minmax(0,1fr)]">
        <div>
          <h2 className="text-xs font-medium">Density</h2>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Operating software should remain compact without sacrificing
            hierarchy or target size.
          </p>
        </div>
        <div className="grid gap-px border bg-border sm:grid-cols-3">
          <DensityExample label="Control" value="2rem" />
          <DensityExample label="Section gap" value="1.5rem" />
          <DensityExample label="Page gutter" value="1.25–3rem" />
        </div>
      </section>
    </div>
  )
}

function DensityExample({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background p-5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-6 text-lg font-medium tabular-nums">{value}</p>
    </div>
  )
}
