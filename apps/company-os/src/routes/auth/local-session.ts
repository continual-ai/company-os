import { createFileRoute } from "@tanstack/react-router"
import { Option, Schema } from "effect"

import { safeReturnTo } from "@/auth-navigation"
import { selectLocalAuthenticationProfile } from "@/server/auth/authentication-experience"
import { localIdentitySessionCookie } from "@/server/auth/local-identity-session"

function redirect(request: Request, path: string, cookie?: string): Response {
  const headers = new Headers({
    "cache-control": "no-store",
    location: new URL(path, request.url).href,
  })
  if (cookie !== undefined) headers.set("set-cookie", cookie)
  return new Response(null, { headers, status: 303 })
}

export const Route = createFileRoute("/auth/local-session")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const form = await request.formData()
        const profileId = Option.getOrUndefined(
          Schema.decodeUnknownOption(Schema.String)(form.get("profileId"))
        )
        const returnTo = safeReturnTo(
          Option.getOrUndefined(
            Schema.decodeUnknownOption(Schema.String)(form.get("returnTo"))
          )
        )
        if (profileId === undefined) {
          return new Response("A local identity is required.", { status: 400 })
        }
        const selection = await selectLocalAuthenticationProfile(profileId)
        if (selection === null) {
          return new Response("That local identity is not available.", {
            status: 400,
          })
        }
        const cookie = localIdentitySessionCookie(
          selection.cookieName,
          selection.profileId
        )
        return redirect(request, returnTo, cookie)
      },
    },
  },
})
