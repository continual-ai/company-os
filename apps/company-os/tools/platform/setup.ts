import { readFile } from "node:fs/promises"

import { createContinualClient } from "@continual/sdk"
import { z } from "zod"

// Run inside the target Branch's sandbox. The platform resolves the Branch from
// the execution credential; no customer-specific IDs belong in this template.
const client = createContinualClient()
const name = "Company OS: contact briefs"
const instructions = await readFile(
  new URL("./contact-brief.md", import.meta.url),
  "utf8"
)
const pageSchema = z.object({
  automations: z.array(z.object({ id: z.string(), name: z.string() })),
  nextPageToken: z.string().nullish(),
})
const existing: string[] = []
let nextPageToken: string | undefined
do {
  const page = pageSchema.parse(
    await client.tools.callUnsafe({
      connectionId: "continual",
      name: "automations_list",
      arguments: { pageSize: 100, ...(nextPageToken ? { nextPageToken } : {}) },
    })
  )
  existing.push(
    ...page.automations
      .filter((item) => item.name === name)
      .map((item) => item.id)
  )
  nextPageToken = page.nextPageToken ?? undefined
} while (nextPageToken)
if (existing.length > 1)
  throw new Error(
    "Multiple contact-brief Automations exist. Resolve the duplicate before configuring this module."
  )
const trigger = process.argv.includes("--schedule")
  ? { type: "cron", event: [{ type: "cron", schedule: "*/5 * * * *" }] }
  : { type: "manual" }
const result = z
  .object({ automation: z.object({ id: z.string(), branchId: z.string() }) })
  .parse(
    await client.tools.callUnsafe({
      connectionId: "continual",
      name: existing[0] ? "automations_update" : "automations_create",
      arguments: {
        ...(existing[0] ? { automationId: existing[0] } : {}),
        name,
        instructions,
        trigger,
      },
    })
  )
console.log(
  JSON.stringify({
    automationId: result.automation.id,
    branchId: result.automation.branchId,
    trigger: trigger.type,
  })
)
