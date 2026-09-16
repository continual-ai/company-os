import { renderToString } from "react-dom/server"
import { expect, it } from "vitest"

import { DateTime, DateTimeProvider } from "#/components/date-time.tsx"

const now = Date.parse("2026-09-15T18:05:00Z")
const value = "2026-09-15T18:00:00Z"

it("renders the relative date in server HTML using the hydration snapshot", () => {
  const html = renderToString(
    <DateTimeProvider initialNow={now}>
      <DateTime value={value} />
    </DateTimeProvider>
  )
  expect(html).toContain('dateTime="2026-09-15T18:00:00.000Z"')
  expect(html).toContain(">5 min. ago</time>")
  expect(html).toContain("6:00:00 PM UTC")
})

it("keeps concurrent request snapshots separate from the shared browser clock", () => {
  const render = (initialNow: number) =>
    renderToString(
      <DateTimeProvider initialNow={initialNow}>
        <DateTime value={value} />
      </DateTimeProvider>
    )
  expect(render(now)).toContain(">5 min. ago</time>")
  expect(render(now + 60_000)).toContain(">6 min. ago</time>")
  expect(render(now)).toContain(">5 min. ago</time>")
})

it("preserves explicit formats, time zones, and empty fallbacks", () => {
  const html = renderToString(
    <DateTimeProvider initialNow={now}>
      <DateTime
        value={value}
        format="absolute"
        timeZone="America/Los_Angeles"
      />
      <DateTime value={null} fallback="Not yet" />
    </DateTimeProvider>
  )
  expect(html).toContain(">Sep 15, 11:00 AM</time>")
  expect(html).toContain("Not yet")
})
