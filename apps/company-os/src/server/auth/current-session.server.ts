import { Effect } from "effect"

import { applicationRuntime } from "@/server/application-runtime.server"

import { UserAuthentication } from "./user-authentication.server"

/** Returns expected User authentication outcomes while preserving infrastructure failures. */
export function readCurrentSession(headers: Headers) {
  return applicationRuntime.runPromise(
    Effect.gen(function* () {
      const authentication = yield* UserAuthentication
      const user = yield* authentication.authenticate(headers)
      return {
        status: "authenticated" as const,
        user,
      }
    }).pipe(
      Effect.catchTags({
        FirstUserRejected: () =>
          Effect.succeed({ status: "forbidden" as const }),
        InvitationRequired: () =>
          Effect.succeed({ status: "forbidden" as const }),
        InvalidSession: () =>
          Effect.succeed({ status: "unauthenticated" as const }),
      })
    )
  )
}
