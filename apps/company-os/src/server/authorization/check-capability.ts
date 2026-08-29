import { Effect } from "effect"

import type { CapabilityCheck } from "@/capabilities"
import { applicationRuntime } from "@/server/application-runtime"
import { Authentication } from "@/server/auth/authentication"

import { Authorization } from "./authorization-service"

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
