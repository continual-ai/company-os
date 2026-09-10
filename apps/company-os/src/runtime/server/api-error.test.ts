import { Effect, Logger, Schema } from "effect"
import { describe, expect, it } from "vitest"

import type {
  ApiError,
  FailedPreconditionError,
} from "#/runtime/model/index.ts"
import {
  executableModelOperation,
  type ExecutableModelOperation,
} from "#/runtime/model/operations.ts"
import { withApiErrors } from "#/runtime/server/api-error.ts"
import { fixtureModel } from "#/runtime/testing/fixture-model.ts"

type TestFailure =
  | Error
  | {
      readonly _tag: string
      readonly fields?: ReadonlyArray<string>
      readonly objectType?: string
      readonly property?: string
      readonly recordIds?: ReadonlyArray<string>
      readonly reason?: string
    }

function translate(
  error: TestFailure | ApiError<typeof FailedPreconditionError>,
  operation?: ExecutableModelOperation
) {
  return Effect.runPromise(
    withApiErrors(Effect.fail(error), operation).pipe(
      Effect.flip,
      Effect.provide(Logger.layer([Logger.make(() => undefined)]))
    )
  )
}

describe("API error translation", () => {
  it.each([
    ["InvalidIdentityAssertion", "UNAUTHENTICATED"],
    ["ProjectAccessRequired", "PERMISSION_DENIED"],
    ["ObjectWriteConflict", "ABORTED"],
    ["RecordAliasConflict", "ALREADY_EXISTS"],
    ["ObjectDeleteRestricted", "FAILED_PRECONDITION"],
  ])("maps %s to canonical status %s", async (_tag, status) => {
    await expect(translate({ _tag })).resolves.toMatchObject({ status })
  })

  it("preserves resource context for not-found failures", async () => {
    await expect(
      translate({
        _tag: "ObjectNotFound",
        objectType: "account",
        recordIds: ["account_missing"],
      })
    ).resolves.toMatchObject({
      details: {
        resourceId: "account_missing",
        resourceType: "account",
      },
      reason: "NOT_FOUND",
      status: "NOT_FOUND",
    })
  })

  it("preserves Effect Schema field paths", async () => {
    const schemaError = await Effect.runPromise(
      Schema.decodeUnknownEffect(
        Schema.Struct({ domain: Schema.String.check(Schema.isMinLength(3)) })
      )({ domain: "x" }).pipe(Effect.flip)
    )

    await expect(translate(schemaError)).resolves.toMatchObject({
      details: {
        violations: [{ path: ["domain"] }],
      },
      reason: "VALIDATION_FAILED",
      status: "INVALID_ARGUMENT",
    })
  })

  it("maps model uniqueness failures to every participating field", async () => {
    await expect(
      translate({
        _tag: "ObjectUniqueConflict",
        fields: ["parent", "member"],
      })
    ).resolves.toMatchObject({
      details: {
        violations: [
          { path: ["parent"], reason: "NOT_UNIQUE" },
          { path: ["member"], reason: "NOT_UNIQUE" },
        ],
      },
      reason: "ALREADY_EXISTS",
      status: "ALREADY_EXISTS",
    })
  })

  it("sanitizes unexpected typed failures at the public boundary", async () => {
    const failure = new Error("database unavailable")
    await expect(translate(failure)).resolves.toMatchObject({
      details: {},
      reason: "INTERNAL",
      status: "INTERNAL",
    })
  })

  it("preserves declared portable errors and conceals undeclared ones", async () => {
    const error = {
      details: { violations: [] },
      message: "The prospect cannot be converted.",
      reason: "FAILED_PRECONDITION",
      status: "FAILED_PRECONDITION",
    } satisfies ApiError<typeof FailedPreconditionError>
    const convert = executableModelOperation(
      fixtureModel,
      "prospect",
      "convert"
    )
    const list = executableModelOperation(fixtureModel, "prospect", "list")

    await expect(translate(error, convert)).resolves.toEqual(error)
    await expect(translate(error, list)).resolves.toMatchObject({
      reason: "INTERNAL",
      status: "INTERNAL",
    })
  })
})
