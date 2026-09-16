import { Cause, Clock, Context, Effect, Exit, Logger, References } from "effect"

import type { OperationContract } from "#/runtime/contract/operation-contract.ts"
import type { ApiError } from "#/runtime/model/index.ts"
import {
  declaredApiError,
  internalApiError,
} from "#/runtime/server/api-error.ts"
import type { InvocationContext } from "#/runtime/server/invocation.ts"

/** Carry only logging configuration across the HTTP router and MCP SDK runtimes. */
export const loggingContext = Effect.context().pipe(
  Effect.map(
    Context.pick(
      Logger.CurrentLoggers,
      Logger.LogToStderr,
      References.MinimumLogLevel
    )
  )
)

interface LoggedError {
  readonly type: string
  readonly message: string
  readonly stack?: string
  readonly code?: string | number
  readonly cause?: LoggedError
}

/** Error properties are often non-enumerable; never serialize arbitrary error payloads. */
function serializeError(error: unknown, depth = 0): LoggedError {
  if (typeof error !== "object" || error === null)
    return { type: typeof error, message: String(error) }
  const type =
    "_tag" in error && typeof error._tag === "string"
      ? error._tag
      : "name" in error && typeof error.name === "string"
        ? error.name
        : "Error"
  return {
    type,
    message:
      "message" in error && typeof error.message === "string"
        ? error.message
        : type,
    ...("stack" in error && typeof error.stack === "string"
      ? { stack: error.stack }
      : {}),
    ...("code" in error &&
    (typeof error.code === "string" || typeof error.code === "number")
      ? { code: error.code }
      : {}),
    ...("cause" in error && error.cause !== undefined && depth < 8
      ? { cause: serializeError(error.cause, depth + 1) }
      : {}),
  }
}

/** Log after commit/rollback, before sanitizing failures for HTTP and MCP. */
export function withOperationLogging<A, E, R>(
  operation: Effect.Effect<A, E, R>,
  contract: OperationContract,
  invocation: InvocationContext
): Effect.Effect<A, ApiError, R> {
  return Effect.uninterruptibleMask((restore) =>
    Effect.gen(function* () {
      const started = yield* Clock.currentTimeNanos
      const exit = yield* Effect.exit(restore(operation))
      const durationMs =
        Number((yield* Clock.currentTimeNanos) - started) / 1_000_000
      const reasons = Exit.isFailure(exit) ? exit.cause.reasons : []
      const cancelled =
        Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)
      const first = reasons[0]
      const failure =
        Exit.isFailure(exit) && !cancelled
          ? reasons.length === 1 && first?._tag === "Fail"
            ? (declaredApiError(first.error, contract) ?? internalApiError())
            : internalApiError()
          : undefined
      const errors = reasons.flatMap((reason) =>
        reason._tag === "Interrupt"
          ? []
          : [
              {
                kind: reason._tag,
                ...serializeError(
                  reason._tag === "Fail" ? reason.error : reason.defect
                ),
              },
            ]
      )
      yield* Effect.logWithLevel(
        failure?.status === "INTERNAL" ? "Error" : "Info"
      )("Operation completed").pipe(
        Effect.annotateLogs({
          operation: contract.key,
          operationKind: contract.kind,
          actorId: invocation.actorId,
          durationMs,
          outcome: cancelled ? "cancelled" : failure ? "failure" : "success",
          ...(failure
            ? {
                error: {
                  reason: failure.reason,
                  status: failure.status,
                  message: failure.message,
                  causes: errors,
                },
              }
            : {}),
        })
      )
      if (Exit.isSuccess(exit)) return exit.value
      if (failure) return yield* Effect.fail(failure)
      return yield* Effect.failCause(
        Cause.fromReasons<never>(
          reasons.filter((reason) => reason._tag === "Interrupt")
        )
      )
    })
  )
}
