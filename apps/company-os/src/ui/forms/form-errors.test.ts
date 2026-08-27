import type { ApiError, ValidationError } from "@company/runtime"
import { Schema } from "effect"
import { describe, expect, it } from "vitest"

import { FormValidationError, formErrorFromCause } from "./form-errors"

describe("form errors", () => {
  it("partitions local violations by canonical field path", () => {
    const errors = formErrorFromCause(
      new FormValidationError([
        {
          message: "Invalid amount",
          path: ["amount", "amount"],
          reason: "INVALID",
        },
        { message: "Invalid operation", reason: "INVALID" },
      ]),
      "Failed"
    )

    expect(errors.fields.amount).toHaveLength(1)
    expect(errors.fields["amount.amount"]).toHaveLength(1)
    expect(errors.form).toMatchObject([{ message: "Invalid operation" }])
  })

  it("reads typed API violations without exposing transport fallbacks", () => {
    const apiError: ApiError<typeof ValidationError> = {
      details: {
        violations: [
          {
            message: "Expected a domain",
            path: ["domain"],
            reason: "INVALID",
          },
        ],
      },
      message: "The request is invalid.",
      reason: "VALIDATION_FAILED",
      status: "INVALID_ARGUMENT",
    }
    const errors = formErrorFromCause(apiError, "Saving failed.")

    expect(errors.fields.domain).toMatchObject([
      { message: "Expected a domain" },
    ])
    expect(errors.form).toBeUndefined()
  })

  it("maps native Effect client encoding failures to fields", () => {
    const DomainInput = Schema.Struct({
      domain: Schema.String.check(Schema.isMinLength(4)),
    })
    let cause: unknown
    try {
      Schema.encodeUnknownSync(DomainInput)({ domain: "bad" })
    } catch (error) {
      cause = error
    }

    const errors = formErrorFromCause(cause, "Saving failed.")
    expect(errors.fields.domain).toHaveLength(1)
    expect(errors.form).toBeUndefined()
  })

  it("keeps a useful form error when an API supplies no violations", () => {
    const apiError = {
      details: { violations: [] },
      message: "A record with these values already exists.",
      reason: "ALREADY_EXISTS",
      status: "ALREADY_EXISTS",
    } as const
    const errors = formErrorFromCause(apiError, "Saving failed.")

    expect(errors.form).toMatchObject([
      { message: apiError.message, reason: apiError.reason },
    ])
  })
})
