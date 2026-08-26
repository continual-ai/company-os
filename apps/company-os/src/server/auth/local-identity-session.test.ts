import { describe, expect, it } from "vitest"

import {
  localIdentityProfileId,
  localIdentitySessionCookie,
} from "./local-identity-session"

describe("local identity session", () => {
  it("reads only the configured cookie", () => {
    const headers = new Headers({
      cookie: "theme=dark; local-profile=operator; other=value",
    })
    expect(localIdentityProfileId(headers, "local-profile")).toBe("operator")
    expect(localIdentityProfileId(headers, "profile")).toBeUndefined()
  })

  it("creates HttpOnly same-site selection and expiration cookies", () => {
    expect(localIdentitySessionCookie("local-profile", "operator")).toBe(
      "local-profile=operator; Path=/; HttpOnly; SameSite=Lax"
    )
    expect(localIdentitySessionCookie("local-profile")).toBe(
      "local-profile=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"
    )
  })
})
