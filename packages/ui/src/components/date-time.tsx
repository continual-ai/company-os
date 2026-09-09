import { useSyncExternalStore, type ComponentProps } from "react"

import { formatDateTime, type DateTimeFormatOptions } from "#/lib/date-time.ts"

const listeners = new Set<() => void>()
let now = Date.now()
let timer: ReturnType<typeof setInterval> | undefined
const snapshot = () => now
const serverSnapshot = () => undefined
function subscribe(listener: () => void) {
  listeners.add(listener)
  if (timer === undefined) {
    now = Date.now()
    timer = setInterval(() => {
      now = Date.now()
      for (const notify of listeners) notify()
    }, 60_000)
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      clearInterval(timer)
      timer = undefined
    }
  }
}

/** One shared clock refreshes relative labels. SSR uses an absolute UTC label until hydration. */
export function DateTime({
  value,
  kind,
  format,
  locale,
  timeZone,
  fallback = "—",
  ...props
}: Omit<ComponentProps<"time">, "children" | "dateTime" | "title"> &
  Omit<DateTimeFormatOptions, "now"> & {
    readonly value: string | number | Date | null | undefined
    readonly fallback?: string | undefined
  }) {
  const current = useSyncExternalStore(subscribe, snapshot, serverSnapshot)
  const display = formatDateTime(value, {
    kind,
    format,
    locale,
    timeZone:
      timeZone ??
      (current === undefined
        ? "UTC"
        : new Intl.DateTimeFormat().resolvedOptions().timeZone),
    now: current,
  })
  if (display === undefined) return <span {...props}>{fallback}</span>
  return (
    <time
      {...props}
      dateTime={display.dateTime}
      title={display.title}
      aria-label={display.title}
    >
      {display.text}
    </time>
  )
}
