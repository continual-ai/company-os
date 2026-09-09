import { expect, it } from "vitest"

import { defineObject, schema } from "#/runtime/model/index.ts"
import { Person } from "#/runtime/testing/fixture-model.ts"
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

const Campaign = defineObject({
  id: "campaign",
  collection: "campaigns",
  name: "Campaign",
  pluralName: "Campaigns",
  properties: {
    name: schema.string({ minLength: 1 }),
    startDate: schema.date({ nullable: true }),
    endDate: schema.date({ nullable: true }),
  },
  display: { title: "name" },
})
const Post = defineObject({
  id: "post",
  collection: "posts",
  name: "Post",
  pluralName: "Posts",
  properties: {
    title: schema.string(),
    scheduledAt: schema.timestamp({ nullable: true }),
  },
  display: { title: "title" },
})
const Message = defineObject({
  id: "message",
  collection: "messages",
  name: "Message",
  pluralName: "Messages",
  properties: {
    subject: schema.string(),
    scheduledAt: schema.timestamp({ nullable: true }),
    sentAt: schema.timestamp({ nullable: true }),
  },
  display: { title: "subject" },
})

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
  expect(scheduleChanges(Campaign, layout, record, "2026-09-02")).toEqual({
    startDate: "2026-09-02",
    endDate: "2026-09-06",
  })
  expect(
    scheduleChanges(Campaign, layout, record, "2026-09-02", {
      anchor: "2026-09-01",
    })
  ).toEqual({ startDate: "2026-08-31", endDate: "2026-09-04" })
  expect(() =>
    scheduleChanges(Campaign, layout, record, "2026-08-29", { resize: true })
  ).toThrow("before")
  expect(
    scheduleChanges(
      Post,
      { type: "calendar", start: "scheduledAt" },
      {
        id: "post_test",
        etag: "1",
        scheduledAt: "2026-03-07T16:30:00.000Z",
      },
      "2026-03-09"
    )
  ).toEqual({ scheduledAt: "2026-03-09T16:30:00.000Z" })
  expect(
    scheduleChanges(
      Message,
      { type: "calendar", start: "scheduledAt", end: "sentAt" },
      {
        id: "message_test",
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
      Campaign,
      { type: "calendar", start: "startDate", end: "endDate" },
      record,
      null
    )
  ).toEqual({ startDate: null, endDate: null })
  expect(
    scheduleChanges(
      Post,
      { type: "calendar", start: "scheduledAt" },
      {
        id: "post_test",
        etag: "1",
        scheduledAt: "2026-09-01T09:00:00.000Z",
      },
      null
    )
  ).toEqual({ scheduledAt: null })
  expect(() =>
    scheduleChanges(
      {
        ...Campaign,
        properties: {
          ...Campaign.properties,
          startDate: { ...Campaign.properties.startDate, nullable: false },
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
  const request = objectListRequest(Campaign, [], [], undefined, window)
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
    collectionLayoutError(Campaign, { type: "kanban", groupBy: "name" })
  ).toContain("select field")
  expect(
    collectionLayoutError(Campaign, {
      type: "gantt",
      start: "startDate",
      end: "startDate",
    })
  ).toContain("different")
  expect(defaultCollectionLayout(Person, "calendar")).toBeUndefined()
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
