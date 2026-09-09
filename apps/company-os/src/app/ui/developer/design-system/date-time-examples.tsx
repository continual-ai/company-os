import { DateTime } from "@company/ui/date-time"

import {
  Example,
  type ComponentSection,
} from "#/app/ui/developer/design-system/example.tsx"

function DateTimeExamples() {
  return (
    <Example
      title="Readable dates and timestamps"
      source="@company/ui/date-time"
    >
      <dl className="grid grid-cols-[auto_1fr] items-center gap-x-8 gap-y-4 text-sm">
        <dt className="text-muted-foreground">Date only</dt>
        <dd>
          <DateTime value="2026-09-19" />
        </dd>
        <dt className="text-muted-foreground">Relative timestamp</dt>
        <dd>
          <DateTime value="2026-09-09T16:00:00Z" />
        </dd>
        <dt className="text-muted-foreground">Absolute timestamp</dt>
        <dd>
          <DateTime value="2026-09-09T16:00:00Z" format="absolute" />
        </dd>
        <dt className="text-muted-foreground">Explicit timezone</dt>
        <dd>
          <DateTime
            value="2026-09-09T16:00:00Z"
            format="absolute"
            timeZone="America/New_York"
          />
        </dd>
        <dt className="text-muted-foreground">Missing value</dt>
        <dd>
          <DateTime value={null} />
        </dd>
      </dl>
      <p className="mt-4 text-xs text-muted-foreground">
        Hover for the exact date and time. Date-only values keep their calendar
        day; timestamps use your local timezone.
      </p>
    </Example>
  )
}
export const dateTimePage = {
  id: "date-time",
  title: "Date and time",
  description:
    "Shared date displays with short relative labels, local timestamps, and an exact value on hover.",
  component: DateTimeExamples,
  usage:
    'import { DateTime } from "@company/ui/date-time"\n\n<DateTime value={record.createdAt} />\n<DateTime value="2026-09-19" />\n<DateTime value={record.updatedAt} format="absolute" />',
} satisfies ComponentSection
