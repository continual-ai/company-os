import { Cause, Deferred, Effect, Exit, Fiber, Logger } from "effect"
import { describe, expect, it } from "vitest"

import { modelOperation } from "#/runtime/contract/operation-contract.ts"
import { internalApiError, withApiErrors } from "#/runtime/server/api-error.ts"
import { ObjectNotFound } from "#/runtime/server/errors.ts"
import { systemInvocation } from "#/runtime/server/invocation-context.ts"
import { withOperationLogging } from "#/runtime/server/logging.ts"
import { fixtureModel } from "#/runtime/testing/fixture-model.ts"

const contract = modelOperation(fixtureModel, "account.get")

function recording() {
  const lines: string[] = []
  const layer = Logger.layer([
    Logger.map(Logger.formatJson, (line) => lines.push(line)),
  ])
  return { lines, layer }
}

describe("operation logging", () => {
  it("logs success once after cleanup without logging the result", async () => {
    const { lines, layer } = recording()
    let released = false
    const result = await Effect.runPromise(
      withOperationLogging(
        Effect.acquireUseRelease(
          Effect.void,
          () => Effect.succeed({ secret: "private result" }),
          () =>
            Effect.sync(() => {
              released = true
            })
        ),
        contract,
        systemInvocation
      ).pipe(
        Effect.annotateLogs({ transport: "http", requestId: "request-1" }),
        Effect.provide(layer)
      )
    )
    expect(released).toBe(true)
    expect(result).toEqual({ secret: "private result" })
    expect(lines).toHaveLength(1)
    expect(lines[0]).not.toContain("private result")
    expect(JSON.parse(lines[0]!)).toMatchObject({
      level: "INFO",
      message: "Operation completed",
      annotations: {
        operation: "account.get",
        operationKind: "query",
        actorId: systemInvocation.actorId,
        transport: "http",
        requestId: "request-1",
        outcome: "success",
        durationMs: expect.any(Number),
      },
    })
  })

  it("logs expected errors with their public reason at info level", async () => {
    const { lines, layer } = recording()
    const error = await Effect.runPromise(
      withOperationLogging(
        Effect.fail(
          new ObjectNotFound({ objectType: "account", recordId: "missing" })
        ),
        contract,
        systemInvocation
      ).pipe(Effect.flip, Effect.provide(layer))
    )
    expect(error.reason).toBe("NOT_FOUND")
    expect(lines).toHaveLength(1)
    expect(JSON.parse(lines[0]!)).toMatchObject({
      level: "INFO",
      annotations: {
        outcome: "failure",
        error: {
          reason: "NOT_FOUND",
          causes: [{ kind: "Fail", type: "ObjectNotFound" }],
        },
      },
    })
  })

  it.each(["fail", "die"] as const)(
    "serializes an unexpected %s and nested SQL code before sanitizing",
    async (kind) => {
      const { lines, layer } = recording()
      const driver = Object.assign(new Error("connection refused"), {
        code: "ECONNREFUSED",
        parameters: ["private parameter"],
      })
      const failure = new Error("database unavailable", { cause: driver })
      const error = await Effect.runPromise(
        withApiErrors(
          withOperationLogging(
            kind === "fail" ? Effect.fail(failure) : Effect.die(failure),
            contract,
            systemInvocation
          ),
          contract
        ).pipe(Effect.flip, Effect.provide(layer))
      )
      expect(error).toEqual(internalApiError())
      expect(lines).toHaveLength(1)
      expect(lines[0]).not.toContain("private parameter")
      expect(JSON.parse(lines[0]!)).toMatchObject({
        level: "ERROR",
        annotations: {
          outcome: "failure",
          error: {
            reason: "INTERNAL",
            causes: [
              {
                kind: kind === "fail" ? "Fail" : "Die",
                type: "Error",
                message: "database unavailable",
                stack: expect.stringContaining("database unavailable"),
                cause: {
                  message: "connection refused",
                  code: "ECONNREFUSED",
                  stack: expect.any(String),
                },
              },
            ],
          },
        },
      })
    }
  )

  it("retains every failure in a combined cause and bounds cyclic error chains", async () => {
    const { lines, layer } = recording()
    const failure = new Error("cyclic")
    failure.cause = failure
    await Effect.runPromise(
      withOperationLogging(
        Effect.failCause(
          Cause.combine(Cause.fail(failure), Cause.die("second failure"))
        ),
        contract,
        systemInvocation
      ).pipe(Effect.exit, Effect.provide(layer))
    )
    expect(lines).toHaveLength(1)
    expect(JSON.parse(lines[0]!)).toMatchObject({
      annotations: {
        error: {
          causes: [
            { kind: "Fail", message: "cyclic" },
            { kind: "Die", message: "second failure" },
          ],
        },
      },
    })
  })

  it("logs cancellation after cleanup and preserves interruption", async () => {
    const { lines, layer } = recording()
    let released = false
    const exit = await Effect.runPromise(
      Effect.gen(function* () {
        const started = yield* Deferred.make<void>()
        const fiber = yield* withOperationLogging(
          Effect.acquireUseRelease(
            Effect.void,
            () =>
              Deferred.succeed(started, undefined).pipe(
                Effect.andThen(Effect.never)
              ),
            () =>
              Effect.sync(() => {
                released = true
              })
          ),
          contract,
          systemInvocation
        ).pipe(Effect.forkChild)
        yield* Deferred.await(started)
        yield* Fiber.interrupt(fiber)
        return yield* Fiber.await(fiber)
      }).pipe(Effect.provide(layer))
    )
    expect(released).toBe(true)
    expect(Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)).toBe(
      true
    )
    expect(lines).toHaveLength(1)
    expect(JSON.parse(lines[0]!)).toMatchObject({
      level: "INFO",
      annotations: { outcome: "cancelled" },
    })
  })
})
