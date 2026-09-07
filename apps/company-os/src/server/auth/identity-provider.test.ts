import { ConfigProvider, Effect } from "effect"
import { afterEach, describe, expect, it, vi } from "vitest"

import { IdentityProvider } from "./identity-provider"

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

function providerWithConfig(env: Readonly<Record<string, string>> = {}) {
  return Effect.runSync(
    IdentityProvider.make.pipe(
      Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnvRecord(env)))
    )
  )
}

describe("IdentityProvider", () => {
  it("uses the App runtime assertion against CONTINUAL_URL", async () => {
    const fetch = vi.fn().mockResolvedValue(
      Response.json({
        actorId: "us_123",
        email: "person@example.com",
        name: "Person",
      })
    )
    vi.stubGlobal("fetch", fetch)
    const provider = providerWithConfig({
      CONTINUAL_URL: "https://continual.example",
    })
    const identified = await Effect.runPromise(
      provider.identify(
        new Headers({
          "x-continual-app-runtime-assertion": "runtime-assertion",
          "x-continual-app-runtime-origin": "https://attacker.example",
        })
      )
    )

    expect(identified?.authorizationSubject).toMatchObject({
      email: "person@example.com",
      issuer: "continual",
      kind: "user",
      name: "Person",
      preferredIdentityId: "us_123",
      subject: "us_123",
    })
    expect(fetch).toHaveBeenCalledWith(
      new URL("https://continual.example/api/apps/runtime/auth/me"),
      {
        method: "GET",
        headers: { authorization: "Bearer runtime-assertion" },
        redirect: "error",
      }
    )
  })

  it("uses the managed preview credential in a Continual sandbox", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        Response.json({ actorId: "us_123", email: null, name: "Person" })
      )
    vi.stubGlobal("fetch", fetch)
    const provider = providerWithConfig({
      CONTINUAL_EXECUTION_TOKEN: "execution-token",
      CONTINUAL_URL: "https://continual.example",
    })

    await Effect.runPromise(provider.identify(new Headers()))

    expect(fetch).toHaveBeenCalledWith(
      new URL("https://continual.example/api/apps/runtime/auth/preview-me"),
      {
        method: "GET",
        headers: { authorization: "Bearer execution-token" },
        redirect: "error",
      }
    )
  })

  it("ignores a runtime assertion when CONTINUAL_URL is unset", async () => {
    vi.stubEnv("MODE", "test")
    const fetch = vi.fn()
    vi.stubGlobal("fetch", fetch)
    const provider = providerWithConfig()
    await expect(
      Effect.runPromise(
        provider.identify(
          new Headers({
            "x-continual-app-runtime-assertion": "runtime-assertion",
            "x-continual-app-runtime-origin": "https://attacker.example",
          })
        )
      )
    ).resolves.toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it("uses a stable local identity in the development server", async () => {
    vi.stubEnv("MODE", "development")
    const provider = providerWithConfig()
    await expect(
      Effect.runPromise(provider.identify(new Headers()))
    ).resolves.toEqual({
      actor: {
        email: "developer@company.test",
        issuer: "local-development",
        kind: "user",
        name: "Local Developer",
        subject: "default",
      },
      authorizationSubject: {
        email: "developer@company.test",
        issuer: "local-development",
        kind: "user",
        name: "Local Developer",
        subject: "default",
      },
    })
  })

  it("treats requests without a provider credential as anonymous outside development", async () => {
    vi.stubEnv("MODE", "test")
    const provider = providerWithConfig()
    await expect(
      Effect.runPromise(provider.identify(new Headers()))
    ).resolves.toBeNull()
  })
})
