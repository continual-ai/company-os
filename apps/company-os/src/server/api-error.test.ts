import { Effect } from "effect"
import { describe, expect, it } from "vitest"

import { withApiErrors } from "./api-error.server"

type TestFailure =
  | Error
  | {
      readonly _tag: string
      readonly objectType?: string
      readonly recordIds?: ReadonlyArray<string>
    }

function translate(error: TestFailure) {
  return Effect.runPromise(withApiErrors(Effect.fail(error)).pipe(Effect.flip))
}

describe("API error translation", () => {
  it.each([
    ["InvalidSession", "unauthenticated"],
    ["PermissionDenied", "permissionDenied"],
    ["ObjectWriteConflict", "conflict"],
    ["InvalidApiKeyRequest", "validation"],
  ])("maps %s to the %s contract", async (_tag, code) => {
    await expect(translate({ _tag })).resolves.toMatchObject({ code })
  })

  it("preserves resource context for not-found failures", async () => {
    await expect(
      translate({
        _tag: "ObjectNotFound",
        objectType: "company",
        recordIds: ["company_missing"],
      })
    ).resolves.toMatchObject({
      code: "notFound",
      details: {
        resourceId: "company_missing",
        resourceType: "company",
      },
    })
  })

  it("does not turn infrastructure failures into public API errors", async () => {
    const failure = new Error("database unavailable")
    await expect(translate(failure)).resolves.toBe(failure)
  })
})
