import { createFileRoute } from "@tanstack/react-router"

import { syncGitHubRepository } from "#/app/server/github-sync.ts"

export const Route = createFileRoute("/api/integrations/github/$id")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        // Browser requests must originate from this app. Platform clients can omit Origin.
        const origin = request.headers.get("origin")
        if (origin && origin !== new URL(request.url).origin)
          return new Response(null, { status: 403 })
        try {
          return Response.json(await syncGitHubRepository(request, params.id))
        } catch {
          return Response.json(
            {
              error:
                "Repository sync failed. Check project admission, Connection access, and the App's get_repository permission.",
            },
            { status: 502 }
          )
        }
      },
    },
  },
})
