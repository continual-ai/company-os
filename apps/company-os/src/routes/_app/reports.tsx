import { AcmeModel } from "@acme/api"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@acme/ui/components/card"
import { createFileRoute } from "@tanstack/react-router"

import { operatingTasks } from "@/operate-data"
import { pageOptions } from "@/route-metadata"

const objectCount = Object.values(AcmeModel.objects).length
const linkCount = Object.values(AcmeModel.links).length

const page = {
  breadcrumb: "Reports",
  description:
    "Review operational indicators and establish governed business metrics as Acme needs them.",
  title: "Reports",
}

export const Route = createFileRoute("/_app/reports")({
  ...pageOptions(page),
  component: ReportsPage,
})

function ReportsPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-5 py-10 lg:px-10 lg:py-12">
      <header>
        <p className="text-sm font-medium text-muted-foreground">Operate</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Reports</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          Start with observable operating state. Business metrics should be
          added when Acme defines the interpretation and decision they support.
        </p>
      </header>

      <section className="mt-10 grid gap-4 sm:grid-cols-3">
        <Indicator label="Object types" value={objectCount} />
        <Indicator label="Open tasks" value={operatingTasks.length} />
        <Indicator label="Defined relationships" value={linkCount} />
      </section>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>No business reports yet</CardTitle>
          <CardDescription>
            Reporting belongs here once a concrete operating question defines
            the source, calculation, unit, and relevant context.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}

function Indicator({ label, value }: { label: string; value: number }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground">
        Current Company OS state
      </CardContent>
    </Card>
  )
}
