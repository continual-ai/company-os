import { describe, expect, it } from "vitest"

import { generateSecret, hashSecret, secretMatches } from "./secret-token"

describe("opaque authentication secrets", () => {
  it("generates independent URL-safe secrets and verifies only their hashes", () => {
    const first = generateSecret()
    const second = generateSecret()

    expect(first).not.toBe(second)
    expect(first).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(hashSecret(first)).not.toContain(first)
    expect(secretMatches(first, hashSecret(first))).toBe(true)
    expect(secretMatches(second, hashSecret(first))).toBe(false)
  })
})
