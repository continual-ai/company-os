import { Effect, Logger, Schema } from "effect"
import { describe, expect, it } from "vitest"

import {
  modelOperation,
  type OperationContract,
} from "#/runtime/contract/operation-contract.ts"
import type {
  ApiError,
  FailedPreconditionError,
} from "#/runtime/model/index.ts"
import { withApiErrors } from "#/runtime/server/api-error.ts"
import { InvalidIdentityAssertion } from "#/runtime/server/auth/identity-provider.ts"
import {
  ProjectAccessRequired,
  ObjectWriteConflict,
  RecordAliasConflict,
  ObjectDeleteRestricted,
  ObjectNotFound,
  ObjectUniqueConflict,
} from "#/runtime/server/errors.ts"
import { fixtureModel } from "#/runtime/testing/fixture-model.ts"

function translate(error: unknown, operation?: OperationContract) {
  return Effect.runPromise(
    withApiErrors(Effect.fail(error), operation).pipe(
      Effect.flip,
      Effect.provide(Logger.layer([Logger.make(() => undefined)]))
    )
  )
}

describe("API error translation", () => {
  it.each([
    [new InvalidIdentityAssertion({ reason: "invalid" }), "UNAUTHENTICATED"],
    [new ProjectAccessRequired(), "PERMISSION_DENIED"],
    [
      new ObjectWriteConflict({ objectType: "account", recordId: "missing" }),
      "ABORTED",
    ],
    [
      new RecordAliasConflict({
        alias: "test:id",
        conflictingRecordId: "existing",
        recordId: "new",
      }),
      "ALREADY_EXISTS",
    ],
    [
      new ObjectDeleteRestricted({
        objectType: "account",
        recordIds: ["existing"],
      }),
      "FAILED_PRECONDITION",
    ],
  ])("maps %s to canonical status %s", async (error, status) => {
    await expect(translate(error)).resolves.toMatchObject({ status })
  })

  it("preserves resource context for not-found failures", async () => {
    await expect(
      translate(
        new ObjectNotFound({
          objectType: "account",
          recordId: "account_missing",
        })
      )
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
      translate(
        new ObjectUniqueConflict({
          fields: ["parent", "member"],
          objectType: "account",
          rule: "members",
        })
      )
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
    const convert = modelOperation(fixtureModel, "prospect.convert")
    const list = modelOperation(fixtureModel, "prospect.list")

    await expect(translate(error, convert)).resolves.toEqual(error)
    await expect(translate(error, list)).resolves.toMatchObject({
      reason: "INTERNAL",
      status: "INTERNAL",
    })
  })
})
