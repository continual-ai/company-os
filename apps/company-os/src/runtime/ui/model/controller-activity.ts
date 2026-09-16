import type { QueryOutput } from "#/runtime/model/index.ts"
import type { ControllerStatus } from "#/runtime/platform/model/controller-status.ts"

type Status = Pick<
  QueryOutput<typeof ControllerStatus>,
  "state" | "paused" | "enabled"
>

export type ControllerActivity =
  | Status["state"]
  | "paused"
  | "disabled"
  | "loading"
  | "unavailable"

export const controllerActivityLabels: Record<ControllerActivity, string> = {
  notStarted: "Not started",
  idle: "Idle",
  pending: "Queued",
  running: "Updating",
  error: "Needs attention",
  paused: "Paused",
  disabled: "Disabled",
  loading: "Checking…",
  unavailable: "Status unavailable",
}

export function controllerActivity(
  status: Status | undefined,
  unavailable: boolean
): ControllerActivity {
  // A failed refresh must not present cached observations as current status.
  if (unavailable) return "unavailable"
  if (!status) return "loading"
  // Pausing prevents new work but does not interrupt an admitted run or clear errors.
  if (status.state === "running" || status.state === "error")
    return status.state
  if (!status.enabled) return "disabled"
  if (status.paused) return "paused"
  return status.state
}

export function controllerActivitySummary(
  activities: ReadonlyArray<ControllerActivity>
) {
  const count = (state: ControllerActivity) =>
    activities.filter((activity) => activity === state).length
  const running = count("running")
  const attention = count("error") + count("unavailable")
  const pending = count("pending")
  const label =
    activities.length === 1
      ? controllerActivityLabels[activities[0]!]
      : running
        ? `Updating · ${running}`
        : attention
          ? `Needs attention · ${attention}`
          : pending
            ? `Queued · ${pending}`
            : count("loading")
              ? "Checking…"
              : activities.every((activity) => activity === "paused")
                ? `Paused · ${activities.length}`
                : `Controllers · ${activities.length}`
  return { label, running, attention }
}

export function controllerElapsed(startedAt: string, now: number) {
  const seconds = Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000))
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
}
