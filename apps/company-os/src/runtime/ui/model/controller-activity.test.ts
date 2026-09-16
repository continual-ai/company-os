import { expect, it } from "vitest"

import {
  controllerActivity,
  controllerActivitySummary,
  controllerElapsed,
} from "#/runtime/ui/model/controller-activity.ts"

it("shows admitted runs and unresolved errors even when new runs are paused", () => {
  for (const state of ["running", "error"] as const) {
    expect(
      controllerActivity({ state, enabled: true, paused: true }, false)
    ).toBe(state)
    expect(
      controllerActivity({ state, enabled: false, paused: false }, false)
    ).toBe(state)
  }
  expect(
    controllerActivity({ state: "pending", enabled: true, paused: true }, false)
  ).toBe("paused")
  expect(
    controllerActivity(
      { state: "pending", enabled: false, paused: false },
      false
    )
  ).toBe("disabled")
})

it("does not mistake unavailable or not-yet-loaded observations for idle", () => {
  expect(controllerActivity(undefined, false)).toBe("loading")
  expect(controllerActivity(undefined, true)).toBe("unavailable")
  expect(
    controllerActivity({ state: "idle", enabled: true, paused: false }, true)
  ).toBe("unavailable")
  expect(controllerActivitySummary(["idle", "unavailable"])).toMatchObject({
    label: "Needs attention · 1",
    attention: 1,
  })
  expect(controllerActivitySummary(["idle", "loading"]).label).toBe("Checking…")
})

it("coalesces controllers without hiding errors while other work runs", () => {
  expect(
    controllerActivitySummary(["running", "running", "error", "pending"])
  ).toEqual({
    label: "Updating · 2",
    running: 2,
    attention: 1,
  })
  expect(controllerActivitySummary(["idle", "pending"]).label).toBe(
    "Queued · 1"
  )
  expect(controllerActivitySummary(["idle", "idle"]).label).toBe(
    "Controllers · 2"
  )
  expect(controllerActivitySummary(["paused", "paused"]).label).toBe(
    "Paused · 2"
  )
  expect(controllerActivitySummary(["notStarted"]).label).toBe("Not started")
})

it("formats elapsed time and tolerates server clock skew", () => {
  const start = "2026-09-16T00:00:00Z"
  const now = Date.parse(start)
  expect(controllerElapsed(start, now - 5000)).toBe("0s")
  expect(controllerElapsed(start, now + 24_000)).toBe("24s")
  expect(controllerElapsed(start, now + 75_000)).toBe("1m 15s")
  expect(controllerElapsed(start, now + 3_700_000)).toBe("1h 1m")
})
