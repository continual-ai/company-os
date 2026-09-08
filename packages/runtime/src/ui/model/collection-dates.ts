import type { ObjectType } from "#/model/index.ts"
import type {
  CollectionLayout,
  ScheduleLayout,
} from "#/ui/model/collection-layout.ts"
import type { ClientRecord } from "#/ui/model/object-client.ts"

const dayMs = 86_400_000
/** Date-only fields never pass through local timezone conversion. Timestamp layouts use UTC. */
export function calendarDay(value: unknown): string | undefined {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value))
    return undefined
  const datePart = value.slice(0, 10)
  const date = new Date(`${datePart}T00:00:00Z`)
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== datePart
  )
    return undefined
  const parsed = new Date(value)
  return Number.isFinite(parsed.getTime())
    ? parsed.toISOString().slice(0, 10)
    : undefined
}
export function addDays(day: string, days: number) {
  return new Date(new Date(`${day}T00:00:00Z`).getTime() + days * dayMs)
    .toISOString()
    .slice(0, 10)
}
export function daysBetween(start: string, end: string) {
  return Math.round(
    (new Date(`${end}T00:00:00Z`).getTime() -
      new Date(`${start}T00:00:00Z`).getTime()) /
      dayMs
  )
}
export function shiftMonth(day: string, months: number) {
  const date = new Date(`${day.slice(0, 7)}-01T00:00:00Z`)
  date.setUTCMonth(date.getUTCMonth() + months)
  return date.toISOString().slice(0, 10)
}
export function dateLabel(
  day: string,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }
) {
  return new Intl.DateTimeFormat("en", { ...options, timeZone: "UTC" }).format(
    new Date(`${day}T00:00:00Z`)
  )
}
export interface CollectionDateWindow {
  readonly startField: string
  readonly endField?: string
  readonly first: string
  readonly after: string
}
export function collectionDateWindow(
  layout: CollectionLayout | undefined,
  anchor: string
): CollectionDateWindow | undefined {
  if (layout?.type !== "calendar" && layout?.type !== "gantt") return undefined
  const month = `${anchor.slice(0, 7)}-01`
  const weekday = new Date(`${month}T00:00:00Z`).getUTCDay()
  const first = addDays(month, -(weekday + 6) % 7)
  return {
    startField: layout.start,
    ...(layout.end === undefined ? {} : { endField: layout.end }),
    first,
    after: addDays(first, 42),
  }
}
export function dateFieldValue(object: ObjectType, field: string, day: string) {
  const property = object.properties[field]
  return property?.kind === "string" && property.format === "timestamp"
    ? `${day}T09:00:00.000Z`
    : day
}

/** Moves a range together, preserving duration and time-of-day; null clears its mapped dates. */
export function scheduleChanges(
  object: ObjectType,
  layout: ScheduleLayout,
  record: ClientRecord,
  day: string | null,
  options: { resize?: boolean | undefined; anchor?: string | undefined } = {}
) {
  if (day === null) {
    const fields = [
      layout.start,
      ...(layout.end === undefined ? [] : [layout.end]),
    ]
    if (fields.some((field) => !object.properties[field]?.nullable))
      throw new Error("Required dates cannot be cleared.")
    return Object.fromEntries(fields.map((field) => [field, null]))
  }
  const start = calendarDay(record[layout.start])
  const destination =
    !options.resize && start !== undefined && options.anchor !== undefined
      ? addDays(day, -daysBetween(start, options.anchor))
      : day
  const shift = start === undefined ? 0 : daysBetween(start, destination)
  const shifted = (field: string) => {
    const value = record[field]
    if (typeof value !== "string" || calendarDay(value) === undefined)
      return dateFieldValue(object, field, day)
    return value.length === 10
      ? addDays(value, shift)
      : new Date(new Date(value).getTime() + shift * dayMs).toISOString()
  }
  const validate = (changes: Record<string, string>) => {
    const nextStart = changes[layout.start] ?? record[layout.start]
    const nextEnd =
      layout.end === undefined
        ? undefined
        : (changes[layout.end] ?? record[layout.end])
    if (typeof nextStart === "string" && typeof nextEnd === "string") {
      const inverted =
        nextStart.includes("T") && nextEnd.includes("T")
          ? new Date(nextEnd).getTime() < new Date(nextStart).getTime()
          : (calendarDay(nextEnd) ?? "") < (calendarDay(nextStart) ?? "")
      if (inverted)
        throw new Error(
          "The end cannot be before the start. Edit the date range first."
        )
    }
    return changes
  }
  if (options.resize && layout.end !== undefined) {
    if (start !== undefined && day < start)
      throw new Error("The end cannot be before the start.")
    const previous = record[layout.end]
    const time =
      typeof previous === "string" && previous.includes("T")
        ? new Date(previous).toISOString().slice(10)
        : ""
    return validate({
      [layout.end]: time
        ? `${day}${time}`
        : dateFieldValue(object, layout.end, day),
    })
  }
  return validate({
    [layout.start]:
      start === undefined
        ? dateFieldValue(object, layout.start, day)
        : shifted(layout.start),
    ...(layout.end === undefined ||
    record[layout.end] === null ||
    record[layout.end] === undefined
      ? {}
      : { [layout.end]: shifted(layout.end) }),
  })
}
