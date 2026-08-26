import { createFileRoute } from "@tanstack/react-router"

import { readSignOutPath } from "@/server/auth/authentication-experience"
import { localIdentitySessionCookie } from "@/server/auth/local-identity-session"

export const Route = createFileRoute("/sign-out")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const target = await readSignOutPath()
        const headers = new Headers({
          "cache-control": "no-store",
          location: new URL(target.path, request.url).href,
        })
        if (target.cookieName !== undefined) {
          headers.set(
            "set-cookie",
            localIdentitySessionCookie(target.cookieName)
          )
        }
        return new Response(null, { headers, status: 303 })
      },
    },
  },
})
