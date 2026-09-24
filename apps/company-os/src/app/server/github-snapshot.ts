import { createAppServerClient } from "@continual/sdk/app"
import { z } from "zod"

const snapshotSchema = z.object({
  repository: z.object({
    node_id: z.string().min(1),
    full_name: z.string().min(1),
    html_url: z.string().url(),
    description: z.string().nullable(),
    default_branch: z.string().nullable(),
    visibility: z.enum(["public", "private", "internal"]),
    archived: z.boolean(),
    updated_at: z.string().datetime(),
  }),
})

export async function readGitHubSnapshot(
  request: Request,
  connectionId: string,
  repo: string
) {
  const client = createAppServerClient({ request })
  return snapshotSchema.parse(
    await client.tools.callUnsafe({
      connectionId,
      name: "get_repository",
      arguments: { repo },
    })
  ).repository
}
