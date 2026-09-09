import { expect, it } from "vitest"

import { formatDateTime } from "#/lib/date-time.ts"

const now = Date.parse("2026-09-09T16:00:00Z")
const options = { now, timeZone: "America/Los_Angeles" }

it("uses short relative labels and retains an exact localized timestamp", () => {
  expect(formatDateTime("2026-09-09T15:57:00Z", options)?.text).toBe(
    "3 min. ago"
  )
  expect(formatDateTime("2026-09-09T18:00:00Z", options)?.text).toBe("in 2 hr.")
  expect(formatDateTime("2026-09-09T15:59:59Z", options)?.text).toBe("now")
  expect(formatDateTime("2026-09-08T16:00:00Z", options)?.text).toBe(
    "yesterday"
  )
  const display = formatDateTime("2026-09-19T11:18:01Z", options)
  expect(display?.text).toBe("Sep 19, 4:18 AM")
  expect(display?.title).toContain("4:18:01 AM")
  expect(display?.dateTime).toBe("2026-09-19T11:18:01.000Z")
})

it("keeps date-only days stable and compares them with today in the viewer's timezone", () => {
  const midnight = Date.parse("2026-09-10T01:00:00Z")
  expect(
    formatDateTime("2026-09-09", { ...options, now: midnight })?.text
  ).toBe("today")
  expect(
    formatDateTime("2026-09-10", { ...options, now: midnight })?.text
  ).toBe("tomorrow")
  expect(formatDateTime("2026-09-19", options)?.text).toBe("Sep 19")
  expect(formatDateTime("2026-09-19", options)?.title).toBe(
    "Saturday, September 19, 2026"
  )
})

it("compares calendar days across daylight-saving transitions", () => {
  expect(
    formatDateTime("2026-03-08", {
      timeZone: "America/Los_Angeles",
      now: Date.parse("2026-03-09T07:30:00Z"),
    })?.text
  ).toBe("yesterday")
})

it("shows the year outside the current year and provides deterministic server labels", () => {
  expect(formatDateTime("2025-09-19", options)?.text).toBe("Sep 19, 2025")
  expect(formatDateTime("2026-09-09T16:00:00Z")?.text).toBe(
    "Sep 9, 2026, 4:00 PM"
  )
  expect(
    formatDateTime("2026-09-09T16:00:00Z", { ...options, format: "absolute" })
      ?.text
  ).toBe("Sep 9, 9:00 AM")
})

it("handles empty and invalid values without inventing dates", () => {
  for (const value of [
    null,
    undefined,
    "",
    "invalid",
    "2026-02-30",
    new Date(NaN),
  ])
    expect(formatDateTime(value, options)).toBeUndefined()
})
