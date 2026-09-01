import { Effect } from "effect"

import { applicationRuntime } from "@/server/application-runtime"

import { Authentication } from "./authentication"

/** Resolves the browser User represented by the current verified request. */
export function readCurrentUser(headers: Headers) {
  return applicationRuntime.runPromise(
    Effect.gen(function* () {
      const authentication = yield* Authentication
      const user = yield* authentication.currentUser(headers)
      if (user === null) return { status: "unauthenticated" as const }
      return {
        status: "authenticated" as const,
        user,
      }
    }).pipe(
      Effect.catchTags({
        InvalidIdentityAssertion: () =>
          Effect.succeed({ status: "unauthenticated" as const }),
      })
    )
  )
}
