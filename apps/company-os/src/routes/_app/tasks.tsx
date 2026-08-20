import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@acme/ui/components/card"
import { createFileRoute } from "@tanstack/react-router"
import { CheckCircle2Icon, CircleIcon } from "lucide-react"

import { operatingTasks } from "@/operate-data"
import { pageOptions } from "@/route-metadata"

const page = {
  breadcrumb: "Tasks",
  description: "Review the work that currently needs attention across Acme.",
  title: "Tasks",
}

export const Route = createFileRoute("/_app/tasks")({
  ...pageOptions(page),
  component: TasksPage,
})

function TasksPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-5 py-10 lg:px-10 lg:py-12">
      <header>
        <p className="text-sm font-medium text-muted-foreground">Operate</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Tasks</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          Review the operating work that currently needs attention.
        </p>
      </header>

      <Card className="mt-10">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>Open tasks</CardTitle>
              <CardDescription>
                The current local operating queue
              </CardDescription>
            </div>
            <span className="text-sm text-muted-foreground tabular-nums">
              {operatingTasks.length}
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {operatingTasks.map((task) => (
            <div
              key={task}
              className="flex min-h-14 items-center gap-3 border-b border-border/50 px-4 py-3 last:border-b-0"
            >
              <CircleIcon className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 text-sm">{task}</span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CheckCircle2Icon className="size-3.5" />
                Open
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
