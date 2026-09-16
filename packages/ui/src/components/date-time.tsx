import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ComponentProps,
  type ReactNode,
} from "react"

import { formatDateTime, type DateTimeFormatOptions } from "#/lib/date-time.ts"

const listeners = new Set<() => void>()
interface ClockSnapshot {
  readonly now: number
  readonly timeZone: string
}
const InitialClock = createContext<ClockSnapshot | undefined>(undefined)
const localTimeZone = new Intl.DateTimeFormat().resolvedOptions().timeZone
let current: ClockSnapshot = { now: Date.now(), timeZone: localTimeZone }
let timer: ReturnType<typeof setInterval> | undefined
const snapshot = () => current
function subscribe(listener: () => void) {
  listeners.add(listener)
  if (timer === undefined) {
    current = { now: Date.now(), timeZone: localTimeZone }
    timer = setInterval(() => {
      current = { now: Date.now(), timeZone: localTimeZone }
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

/** Supply the same serialized request time on the server and during hydration. */
export function DateTimeProvider({
  initialNow,
  children,
}: {
  readonly initialNow: number
  readonly children: ReactNode
}) {
  const initial = useMemo(
    () => ({ now: initialNow, timeZone: "UTC" }),
    [initialNow]
  )
  return <InitialClock value={initial}>{children}</InitialClock>
}

/** One shared browser clock refreshes relative labels; hydration starts from the request snapshot. */
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
  const initial = useContext(InitialClock)
  const serverSnapshot = useCallback(() => initial, [initial])
  const clock = useSyncExternalStore(subscribe, snapshot, serverSnapshot)
  const display = formatDateTime(value, {
    kind,
    format,
    locale,
    timeZone: timeZone ?? clock?.timeZone ?? "UTC",
    now: clock?.now,
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
