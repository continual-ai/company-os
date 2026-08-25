import { Effect, Logger, Schema } from "effect"
import { describe, expect, it } from "vitest"

import { withApiErrors } from "./api-error"

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

function translate(error: TestFailure) {
  return Effect.runPromise(
    withApiErrors(Effect.fail(error)).pipe(
      Effect.flip,
      Effect.provide(Logger.layer([Logger.make(() => undefined)]))
    )
  )
}

describe("API error translation", () => {
  it.each([
    ["InvalidSession", "UNAUTHENTICATED"],
    ["PermissionDenied", "PERMISSION_DENIED"],
    ["ObjectWriteConflict", "ABORTED"],
    ["RecordAliasConflict", "ALREADY_EXISTS"],
    ["LastPlatformAdministrator", "FAILED_PRECONDITION"],
    ["InvalidApiKeyRequest", "INVALID_ARGUMENT"],
  ])("maps %s to canonical status %s", async (_tag, status) => {
    await expect(translate({ _tag })).resolves.toMatchObject({ status })
  })

  it("preserves resource context for not-found failures", async () => {
    await expect(
      translate({
        _tag: "ObjectNotFound",
        objectType: "company",
        recordIds: ["company_missing"],
      })
    ).resolves.toMatchObject({
      details: {
        resourceId: "company_missing",
        resourceType: "company",
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

  it("maps deliberate validation failures to their form fields", async () => {
    await expect(
      translate({ _tag: "InvalidApiKeyRequest", reason: "expiresAt" })
    ).resolves.toMatchObject({
      details: {
        violations: [{ path: ["expiresAt"] }],
      },
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

  it("distinguishes state-dependent failures from invalid arguments", async () => {
    await expect(
      translate({ _tag: "InvalidApiKeyRequest", reason: "disabledAccount" })
    ).resolves.toMatchObject({
      details: {
        violations: [
          {
            path: ["serviceAccount"],
            reason: "SERVICE_ACCOUNT_DISABLED",
          },
        ],
      },
      status: "FAILED_PRECONDITION",
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
})
