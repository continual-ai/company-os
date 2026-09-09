import { Effect } from "effect"

import { applicationRuntime } from "#/app/server/application-runtime.ts"
import type { CapabilityCheck } from "#/runtime/contract/capabilities.ts"
import { Authentication } from "#/runtime/server/auth/authentication.ts"
import { Authorization } from "#/runtime/server/authorization/authorization-service.ts"

/** Resolves one interface capability without weakening operation-level enforcement. */
export function checkCapability(headers: Headers, check: CapabilityCheck) {
  return applicationRuntime.runPromise(
    Effect.gen(function* () {
      const authentication = yield* Authentication
      const authorization = yield* Authorization
      const caller = yield* authentication.identify(headers)
      const result = yield* authorization.checkCapabilitiesFor(caller, [check])
      return result.results[0]?.allowed === true
    }).pipe(Effect.catch(() => Effect.succeed(false)))
  )
}
