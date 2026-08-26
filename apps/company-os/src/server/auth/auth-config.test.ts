import { ConfigProvider, Effect } from "effect"
import { describe, expect, it } from "vitest"

import { loadAuthConfig } from "./auth-config"

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
  it("defaults to a local administrator for development", async () => {
    await expect(load({})).resolves.toEqual({
      provider: {
        email: "developer@company.test",
        kind: "local",
        name: "Local developer",
        subject: "developer",
      },
      provisioningRole: "administrator",
    })
  })

  it("normalizes the verified JWT assertion contract", async () => {
    const config = await load({
      AUTH_JIT_ROLE: "operator",
      AUTH_JWT_AUDIENCE: "company-os",
      AUTH_JWT_DEFAULT_IDENTITY_KIND: "user",
      AUTH_JWT_ISSUER: "https://identity.example.com",
      AUTH_JWT_JWKS_URL: "https://identity.example.com/.well-known/jwks.json",
      AUTH_MODE: "jwt",
    })

    expect(config).toMatchObject({
      provider: {
        algorithms: ["RS256", "ES256", "EdDSA"],
        audience: "company-os",
        clockToleranceSeconds: 30,
        defaultIdentityKind: "user",
        header: "x-company-identity",
        issuer: "https://identity.example.com",
        kind: "jwt",
        kindClaim: "identity_type",
        maxTokenAge: "10m",
        profile: "standard",
      },
      provisioningRole: "operator",
    })
  })

  it("rejects unsupported modes, kinds, roles, and JWKS protocols", async () => {
    await expect(load({ AUTH_MODE: "headers" })).rejects.toThrow(
      "AUTH_MODE must be 'local', 'jwt', or 'google-iap'"
    )
    await expect(
      load({ AUTH_JIT_ROLE: "owner", AUTH_MODE: "local" })
    ).rejects.toThrow("AUTH_JIT_ROLE")
    await expect(
      load({ AUTH_MODE: "local", NODE_ENV: "production" })
    ).rejects.toThrow("AUTH_MODE=local is not allowed")
    await expect(
      load({
        AUTH_JIT_ROLE: "operator",
        AUTH_JWT_AUDIENCE: "company-os",
        AUTH_JWT_DEFAULT_IDENTITY_KIND: "robot",
        AUTH_JWT_ISSUER: "https://identity.example.com",
        AUTH_JWT_JWKS_URL: "https://identity.example.com/jwks.json",
        AUTH_MODE: "jwt",
      })
    ).rejects.toThrow("AUTH_JWT_DEFAULT_IDENTITY_KIND")
    await expect(
      load({
        AUTH_JIT_ROLE: "operator",
        AUTH_JWT_AUDIENCE: "company-os",
        AUTH_JWT_ISSUER: "https://identity.example.com",
        AUTH_JWT_JWKS_URL: "file:///tmp/jwks.json",
        AUTH_MODE: "jwt",
      })
    ).rejects.toThrow("must use HTTP or HTTPS")
  })

  it("provides a strict Google IAP assertion profile", async () => {
    await expect(
      load({
        AUTH_IAP_AUDIENCE:
          "/projects/123/locations/us-central1/services/company-os",
        AUTH_JIT_ROLE: "operator",
        AUTH_MODE: "google-iap",
      })
    ).resolves.toEqual({
      provider: {
        algorithms: ["ES256"],
        audience: "/projects/123/locations/us-central1/services/company-os",
        clockToleranceSeconds: 30,
        defaultIdentityKind: "user",
        header: "x-goog-iap-jwt-assertion",
        issuer: "https://cloud.google.com/iap",
        jwksUrl: new URL("https://www.gstatic.com/iap/verify/public_key-jwk"),
        kind: "jwt",
        kindClaim: "identity_type",
        maxTokenAge: "11m",
        profile: "google-iap",
      },
      provisioningRole: "operator",
    })
  })

  it("requires an explicit deployed JIT role", async () => {
    await expect(
      load({
        AUTH_JWT_AUDIENCE: "company-os",
        AUTH_JWT_ISSUER: "https://identity.example.com",
        AUTH_JWT_JWKS_URL: "https://identity.example.com/jwks.json",
        AUTH_MODE: "jwt",
      })
    ).rejects.toThrow("AUTH_JIT_ROLE")
  })
})
