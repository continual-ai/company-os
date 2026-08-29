import { PageToken } from "@company/runtime"
import { describe, expect, it } from "vitest"

import { makeApplicationKeys } from "./application-keys"
import { makeEncryptedPageTokenCodec } from "./page-tokens"

const firstKeys = makeApplicationKeys(
  "first-test-application-secret-with-at-least-32-bytes"
)
const first = makeEncryptedPageTokenCodec(
  firstKeys.deriveKey("page-token-test:v1")
)

describe("encrypted page tokens", () => {
  it("round-trips opaque cursor state", () => {
    const value = JSON.stringify({ id: "company_1", version: 1 })
    const token = first.encode(value)

    expect(token).not.toContain("company_1")
    expect(token.length).toBeLessThan(160)
    expect(first.decode(token)).toBe(value)
  })

  it("rejects tampering and tokens encrypted with another key", () => {
    const token = first.encode("cursor")
    const index = Math.floor(token.length / 2)
    const replacement = token[index] === "A" ? "B" : "A"
    const tampered = PageToken(
      `${token.slice(0, index)}${replacement}${token.slice(index + 1)}`
    )
    const secondKeys = makeApplicationKeys(
      "second-test-application-secret-with-at-least-32-bytes"
    )
    const second = makeEncryptedPageTokenCodec(
      secondKeys.deriveKey("page-token-test:v1")
    )

    expect(() => first.decode(tampered)).toThrow()
    expect(() => second.decode(token)).toThrow()
  })

  it("rejects keys of the wrong length", () => {
    expect(() => makeEncryptedPageTokenCodec(new Uint8Array(31))).toThrow(
      "requires a 32-byte key"
    )
  })
})
