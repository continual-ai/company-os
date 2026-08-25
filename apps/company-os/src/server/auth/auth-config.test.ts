import { ConfigProvider, Effect, Redacted } from "effect"
import { describe, expect, it } from "vitest"

import { loadAuthConfig } from "./auth-config"

const validEnvironment = {
  AUTH_BOOTSTRAP_EMAIL: "Owner@Example.com",
  AUTH_OIDC_CLIENT_ID: "client-id",
  AUTH_OIDC_CLIENT_SECRET: "client-secret",
  AUTH_OIDC_DISCOVERY_URL:
    "https://accounts.example.com/.well-known/openid-configuration",
  BETTER_AUTH_SECRET: "a-secure-value-with-at-least-32-characters",
  BETTER_AUTH_URL: "http://localhost:3002/",
} satisfies NodeJS.ProcessEnv

function load(environment: Record<string, string>) {
  return Effect.runPromise(
    loadAuthConfig.pipe(
      Effect.provideService(
        ConfigProvider.ConfigProvider,
        ConfigProvider.fromEnv({ env: environment })
      )
    )
  )
}

describe("authentication configuration", () => {
  it("normalizes the deployment contract", async () => {
    const config = await load(validEnvironment)
    expect(config).toMatchObject({
      baseUrl: "http://localhost:3002",
      bootstrapEmail: "owner@example.com",
      oidc: {
        discoveryUrl:
          "https://accounts.example.com/.well-known/openid-configuration",
        name: "Single sign-on",
      },
    })
    expect(Redacted.value(config.secret)).toBe(
      validEnvironment.BETTER_AUTH_SECRET
    )
  })

  it("allows the first verified User to claim an unconfigured installation", async () => {
    const config = await load({
      ...validEnvironment,
      AUTH_BOOTSTRAP_EMAIL: "",
    })
    expect(config.bootstrapEmail).toBeUndefined()
  })

  it("rejects missing, weak, and malformed values", async () => {
    await expect(
      load({ ...validEnvironment, AUTH_OIDC_CLIENT_ID: "" })
    ).rejects.toThrow()
    await expect(
      load({ ...validEnvironment, BETTER_AUTH_SECRET: "too-short" })
    ).rejects.toThrow("at least 32 characters")
    await expect(
      load({
        ...validEnvironment,
        BETTER_AUTH_URL: "file:///tmp/auth",
      })
    ).rejects.toThrow("HTTP or HTTPS")
    await expect(
      load({ ...validEnvironment, AUTH_BOOTSTRAP_EMAIL: "invalid" })
    ).rejects.toThrow("Authentication configuration is invalid")
  })
})
