export interface DateTimeFormatOptions {
  readonly kind?: "date" | "datetime" | undefined
  readonly format?: "relative" | "absolute" | undefined
  readonly locale?: string | undefined
  readonly timeZone?: string | undefined
  readonly now?: number | undefined
}

const dayMs = 86_400_000

function calendarParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const part = (type: string) =>
    Number(parts.find((item) => item.type === type)?.value)
  return {
    year: part("year"),
    day: Date.UTC(part("year"), part("month") - 1, part("day")),
  }
}

/** Date-only values are calendar days; timestamps are instants in the requested time zone. */
export function formatDateTime(
  value: string | number | Date | null | undefined,
  {
    kind,
    format = "relative",
    locale = "en",
    timeZone = "UTC",
    now,
  }: DateTimeFormatOptions = {}
): { text: string; title: string; dateTime: string } | undefined {
  if (value === null || value === undefined || value === "") return undefined
  const dateOnly =
    kind === "date" ||
    (kind === undefined &&
      typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(value))
  const date = new Date(
    typeof value === "string" && dateOnly ? `${value}T00:00:00Z` : value
  )
  if (!Number.isFinite(date.getTime())) return undefined
  if (
    typeof value === "string" &&
    dateOnly &&
    date.toISOString().slice(0, 10) !== value
  )
    return undefined
  const zone = dateOnly ? "UTC" : timeZone
  const title = new Intl.DateTimeFormat(locale, {
    dateStyle: "full",
    ...(dateOnly ? {} : { timeStyle: "long" }),
    timeZone: zone,
  }).format(date)
  const current = now === undefined ? undefined : new Date(now)
  const targetDay = calendarParts(date, zone)
  const today =
    current === undefined ? undefined : calendarParts(current, timeZone)
  let text = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: today?.year === targetDay.year ? undefined : "numeric",
    ...(dateOnly ? {} : { hour: "numeric", minute: "2-digit" }),
    timeZone: zone,
  }).format(date)
  if (format === "relative" && current !== undefined && today !== undefined) {
    const milliseconds = date.getTime() - current.getTime()
    const days = Math.round((targetDay.day - today.day) / dayMs)
    const relative = new Intl.RelativeTimeFormat(locale, {
      numeric: "auto",
      style: "short",
    })
    if (!dateOnly && Math.abs(milliseconds) < 60_000)
      text = relative.format(0, "second")
    else if (!dateOnly && Math.abs(milliseconds) < 3_600_000)
      text = relative.format(Math.trunc(milliseconds / 60_000), "minute")
    else if (!dateOnly && Math.abs(milliseconds) < dayMs && days === 0)
      text = relative.format(Math.trunc(milliseconds / 3_600_000), "hour")
    else if (Math.abs(days) <= 7) text = relative.format(days, "day")
  }
  return {
    text,
    title,
    dateTime: dateOnly ? date.toISOString().slice(0, 10) : date.toISOString(),
  }
}
