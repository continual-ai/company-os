import { Effect } from "effect"

import { applicationRuntime } from "#/app/server/application-runtime.ts"
import { Authentication } from "#/runtime/server/auth/authentication.ts"

export function hasProjectAdmission(headers: Headers) {
  return applicationRuntime.runPromise(
    Effect.gen(function* () {
      const authentication = yield* Authentication
      yield* authentication.invocation(headers)
      return true
    }).pipe(Effect.catch(() => Effect.succeed(false)))
  )
}
