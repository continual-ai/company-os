import { expect, it } from "vitest"

import { Model } from "#/app.model.ts"
import {
  addDays,
  calendarDay,
  collectionDateWindow,
  daysBetween,
  scheduleChanges,
  shiftMonth,
} from "#/runtime/ui/model/collection-dates.ts"
import {
  collectionLayoutError,
  defaultCollectionLayout,
} from "#/runtime/ui/model/collection-layout.ts"
import { objectListRequest } from "#/runtime/ui/model/object-collection-query.ts"
import { validateObjectCollectionSearch } from "#/runtime/ui/model/object-collection-view.ts"

it("keeps calendar dates stable through leap years, month boundaries, and DST", () => {
  expect(addDays("2024-02-28", 1)).toBe("2024-02-29")
  expect(addDays("2026-03-08", 1)).toBe("2026-03-09")
  expect(daysBetween("2026-03-07", "2026-03-09")).toBe(2)
  expect(shiftMonth("2026-01-31", 1)).toBe("2026-02-01")
  expect(calendarDay("invalid")).toBeUndefined()
  expect(calendarDay("2026-02-31")).toBeUndefined()
  expect(
    collectionDateWindow({ type: "calendar", start: "startDate" }, "2026-09-06")
  ).toEqual({
    first: "2026-08-31",
    after: "2026-10-12",
    startField: "startDate",
  })
})

it("moves both dates together and rejects an inverted resize", () => {
  const layout = { type: "gantt", start: "startDate", end: "endDate" } as const
  const record = {
    id: "campaign_test",
    etag: "7",
    startDate: "2026-08-30",
    endDate: "2026-09-03",
  }
  expect(
    scheduleChanges(Model.objects.campaign, layout, record, "2026-09-02")
  ).toEqual({ startDate: "2026-09-02", endDate: "2026-09-06" })
  expect(
    scheduleChanges(Model.objects.campaign, layout, record, "2026-09-02", {
      anchor: "2026-09-01",
    })
  ).toEqual({ startDate: "2026-08-31", endDate: "2026-09-04" })
  expect(() =>
    scheduleChanges(Model.objects.campaign, layout, record, "2026-08-29", {
      resize: true,
    })
  ).toThrow("before")
  expect(
    scheduleChanges(
      Model.objects.content,
      { type: "calendar", start: "scheduledAt" },
      {
        id: "content_test",
        etag: "1",
        scheduledAt: "2026-03-07T16:30:00.000Z",
      },
      "2026-03-09"
    )
  ).toEqual({ scheduledAt: "2026-03-09T16:30:00.000Z" })
  expect(
    scheduleChanges(
      Model.objects.outreach,
      { type: "calendar", start: "scheduledAt", end: "sentAt" },
      {
        id: "content_test",
        etag: "1",
        scheduledAt: "2026-03-07T16:30:00.000Z",
        sentAt: "2026-03-08T23:30:00-07:00",
      },
      "2026-03-10",
      { resize: true }
    )
  ).toEqual({ sentAt: "2026-03-10T06:30:00.000Z" })
})

it("unschedules mapped dates together while protecting required fields", () => {
  const record = {
    id: "campaign_test",
    etag: "1",
    startDate: "2026-09-01",
    endDate: "2026-09-03",
  }
  expect(
    scheduleChanges(
      Model.objects.campaign,
      { type: "calendar", start: "startDate", end: "endDate" },
      record,
      null
    )
  ).toEqual({ startDate: null, endDate: null })
  expect(
    scheduleChanges(
      Model.objects.content,
      { type: "calendar", start: "scheduledAt" },
      {
        id: "content_test",
        etag: "1",
        scheduledAt: "2026-09-01T09:00:00.000Z",
      },
      null
    )
  ).toEqual({ scheduledAt: null })
  const campaign = Model.objects.campaign
  expect(() =>
    scheduleChanges(
      {
        ...campaign,
        properties: {
          ...campaign.properties,
          startDate: { ...campaign.properties.startDate, nullable: false },
        },
      },
      { type: "calendar", start: "startDate" },
      record,
      null
    )
  ).toThrow("Required dates")
})

it("queries overlapping ranges and undated records using the standard list contract", () => {
  const window = collectionDateWindow(
    { type: "gantt", start: "startDate", end: "endDate" },
    "2026-09-06"
  )
  const request = objectListRequest(
    Model.objects.campaign,
    [],
    [],
    undefined,
    window
  )
  expect(request.filter).toEqual({
    or: [
      {
        and: [
          { field: "startDate", operator: "gte", value: "2026-08-31" },
          { field: "startDate", operator: "lt", value: "2026-10-12" },
        ],
      },
      { field: "startDate", operator: "isNull" },
      {
        and: [
          { field: "startDate", operator: "lt", value: "2026-08-31" },
          { field: "endDate", operator: "gte", value: "2026-08-31" },
        ],
      },
    ],
  })
})

it("validates source field mappings and URL layouts without creating saved-view records", () => {
  expect(
    collectionLayoutError(Model.objects.campaign, {
      type: "kanban",
      groupBy: "name",
    })
  ).toContain("select field")
  expect(
    collectionLayoutError(Model.objects.campaign, {
      type: "gantt",
      start: "startDate",
      end: "startDate",
    })
  ).toContain("different")
  expect(
    defaultCollectionLayout(Model.objects.contact, "calendar")
  ).toBeUndefined()
  const state = {
    filters: [],
    sorting: [],
    visibility: {},
    layout: { type: "kanban", groupBy: "status" },
  }
  expect(validateObjectCollectionSearch({ view: "all", state })).toEqual({
    view: "all",
    state,
  })
  expect(() =>
    validateObjectCollectionSearch({
      state: { ...state, layout: { type: "calendar" } },
    })
  ).toThrow()
  expect(() =>
    validateObjectCollectionSearch({ state: { ...state, date: "2026-02-31" } })
  ).toThrow()
})
