import { Button } from "@company/ui/button"
import { formatDateTime } from "@company/ui/lib/date-time"
import { cn } from "@company/ui/lib/utils"
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@company/ui/popover"
import { useInfiniteQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import {
  AlertCircleIcon,
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
  LoaderCircleIcon,
  PauseIcon,
  WorkflowIcon,
} from "lucide-react"
import { useEffect, useState } from "react"

import { PlatformModel } from "#/runtime/platform/model/index.ts"
import {
  controllerActivity,
  controllerActivityLabels,
  controllerActivitySummary,
  controllerElapsed,
  type ControllerActivity,
} from "#/runtime/ui/model/controller-activity.ts"
import { useModelRuntime } from "#/runtime/ui/model/runtime-context.tsx"
import { useClient } from "#/runtime/ui/model/use-client.ts"

function ActivityIcon({ activity }: { readonly activity: ControllerActivity }) {
  if (activity === "running" || activity === "loading")
    return <LoaderCircleIcon className="size-3.5 motion-safe:animate-spin" />
  const Icon =
    activity === "error" || activity === "unavailable"
      ? AlertCircleIcon
      : activity === "pending"
        ? ClockIcon
        : activity === "paused" || activity === "disabled"
          ? PauseIcon
          : activity === "idle"
            ? CheckIcon
            : WorkflowIcon
  return <Icon className="size-3.5" />
}

export function RecordControllerStatus({
  objectType,
  recordId,
  onViewDetails,
}: {
  readonly objectType: string
  readonly recordId: string
  readonly onViewDetails: () => void
}) {
  const { model } = useModelRuntime()
  const client = useClient(PlatformModel)
  const [open, setOpen] = useState(false)
  const definitions = Object.values(model.modules)
    .flatMap((module) => module.controllers)
    .filter(
      (controller) =>
        controller.objectType === objectType && controller.scope === "record"
    )
  const query = useInfiniteQuery({
    ...client.controllerInstance.list.infiniteQueryOptions({
      filter: {
        link: "record",
        some: {
          field: "id",
          operator: "eq",
          value: recordId,
        },
      },
      expand: { controller: true },
      pageSize: 100,
    }),
    enabled: definitions.length > 0,
    refetchInterval: 3000,
  })
  const { hasNextPage, isFetching, isError, fetchNextPage } = query
  useEffect(() => {
    if (hasNextPage && !isFetching && !isError)
      void fetchNextPage({ cancelRefetch: false })
  }, [hasNextPage, isFetching, isError, fetchNextPage])
  if (definitions.length === 0) return null
  const instances = query.data?.pages.flatMap((page) => page.items) ?? []
  const statuses = definitions.map((definition) => {
    const instance = instances.find(
      (item) => item.links.controller?.definitionId === definition.id
    )
    return instance
      ? {
          ...instance,
          enabled: true,
          paused: instance.links.controller?.paused ?? false,
        }
      : undefined
  })
  const activities = statuses.map((status) =>
    controllerActivity(
      status ??
        (query.data && !hasNextPage
          ? { state: "notStarted", paused: false, enabled: true }
          : undefined),
      query.isError
    )
  )
  const summary = controllerActivitySummary(activities)
  const label =
    definitions.length === 1
      ? `${definitions[0]!.name} · ${summary.label}`
      : summary.label
  const badgeActivity = summary.running
    ? "running"
    : summary.attention
      ? "error"
      : activities.includes("pending")
        ? "pending"
        : definitions.length === 1
          ? activities[0]!
          : "notStarted"
  // Observe poll timestamps so elapsed time updates even when the payload is unchanged.
  const now = query.dataUpdatedAt
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={`${label}${summary.running && summary.attention ? ` · ${summary.attention} needs attention` : ""}. Show controller status`}
        render={
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "max-w-full font-normal",
              summary.running && "bg-info/10 text-info",
              summary.attention && !summary.running && "text-destructive"
            )}
          />
        }
      >
        <ActivityIcon activity={badgeActivity} />
        <span className="truncate">{label}</span>
        {summary.running > 0 && summary.attention > 0 && (
          <span className="inline-flex items-center gap-1 border-l pl-1.5 text-destructive">
            <AlertCircleIcon className="size-3.5" />
            {summary.attention}
          </span>
        )}
        <ChevronDownIcon className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-88 max-w-[calc(100vw-2rem)] gap-0 p-0"
      >
        <PopoverTitle className="border-b px-4 py-3">Controllers</PopoverTitle>
        <ul className="max-h-80 overflow-y-auto divide-y">
          {definitions.map((definition, index) => {
            const status = statuses[index]
            const activity = activities[index]!
            const completed = formatDateTime(status?.lastSucceededAt, { now })
            return (
              <li key={definition.id} className="space-y-1 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  {status ? (
                    <Link
                      className="font-medium hover:underline"
                      to="/objects/$objectType/$recordId"
                      params={{
                        objectType: "controllerInstance",
                        recordId: status.id,
                      }}
                    >
                      {definition.name}
                    </Link>
                  ) : (
                    <span className="font-medium">{definition.name}</span>
                  )}
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 text-muted-foreground",
                      (activity === "error" || activity === "unavailable") &&
                        "text-destructive"
                    )}
                  >
                    <ActivityIcon activity={activity} />
                    {controllerActivityLabels[activity]}
                    {activity === "running" && status?.lastStartedAt && (
                      <span className="tabular-nums">
                        · {controllerElapsed(status.lastStartedAt, now)}
                      </span>
                    )}
                  </span>
                </div>
                <p className="text-muted-foreground">
                  {activity === "unavailable" ? (
                    "Could not refresh status. Retrying automatically."
                  ) : activity === "error" ? (
                    "Last run failed. Open details for the error."
                  ) : activity === "running" ? (
                    "Reconciliation is in progress."
                  ) : activity === "pending" ? (
                    "Waiting to reconcile the latest changes."
                  ) : completed ? (
                    <>
                      Last completed{" "}
                      <time
                        dateTime={completed.dateTime}
                        title={completed.title}
                      >
                        {completed.text}
                      </time>
                      .
                    </>
                  ) : (
                    "No completed runs yet."
                  )}
                </p>
                {status && (!status.enabled || status.paused) && (
                  <p className="text-muted-foreground">
                    {!status.enabled
                      ? "Module disabled."
                      : "New runs are paused."}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
        <div className="border-t p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={() => {
              setOpen(false)
              onViewDetails()
            }}
          >
            View controller details
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
