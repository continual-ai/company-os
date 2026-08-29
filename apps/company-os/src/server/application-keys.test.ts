import { describe, expect, it } from "vitest"

import { makeApplicationKeys } from "./application-keys"

describe("application keys", () => {
  it("derives stable, purpose-separated keys", () => {
    const keys = makeApplicationKeys(
      "application-key-test-secret-with-at-least-32-bytes"
    )

    expect(keys.deriveKey("page-token:v1")).toEqual(
      keys.deriveKey("page-token:v1")
    )
    expect(keys.deriveKey("page-token:v1")).not.toEqual(
      keys.deriveKey("another-purpose:v1")
    )
    expect(keys.deriveKey("page-token:v1")).toHaveLength(32)
  })

  it("rejects weak secrets and empty purposes", () => {
    expect(() => makeApplicationKeys("too-short")).toThrow(
      "APP_SECRET must contain at least 32 bytes."
    )
    const keys = makeApplicationKeys(
      "application-key-test-secret-with-at-least-32-bytes"
    )
    expect(() => keys.deriveKey("")).toThrow(
      "Application key purposes must be non-empty."
    )
  })
})
