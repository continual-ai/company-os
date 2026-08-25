import type { ApiError, ValidationError } from "@company/runtime"
import { ApiClientResponseError } from "@company/runtime/client"
import { describe, expect, it } from "vitest"

import {
  FormValidationError,
  errorsForField,
  formErrorsFromCause,
} from "./form-errors"

describe("form errors", () => {
  it("partitions local violations by canonical field path", () => {
    const errors = formErrorsFromCause(
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

    expect(errorsForField(errors, "amount")).toHaveLength(1)
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
    const errors = formErrorsFromCause(
      new ApiClientResponseError(400, JSON.stringify(apiError), apiError),
      "Saving failed."
    )

    expect(errorsForField(errors, "domain")).toMatchObject([
      { message: "Expected a domain" },
    ])
    expect(errors.form).toEqual([])
  })

  it("keeps a useful form error when an API supplies no violations", () => {
    const apiError = {
      details: { violations: [] },
      message: "A record with these values already exists.",
      reason: "ALREADY_EXISTS",
      status: "ALREADY_EXISTS",
    } as const
    const errors = formErrorsFromCause(
      new ApiClientResponseError(409, JSON.stringify(apiError), apiError),
      "Saving failed."
    )

    expect(errors.form).toMatchObject([
      { message: apiError.message, reason: apiError.reason },
    ])
  })
})
