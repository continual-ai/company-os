import { ConfigProvider, Effect } from "effect"
import { afterEach, describe, expect, it, vi } from "vitest"

import { makeContinualIdentityProvider } from "#/app/server/auth/identity-provider.ts"

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("IdentityProvider", () => {
  it("uses the App runtime assertion and preserves the Continual actor ID", async () => {
    const fetch = vi.fn().mockResolvedValue(
      Response.json({
        actorId: "us_123",
        email: "person@example.com",
        name: "Person",
      })
    )
    vi.stubGlobal("fetch", fetch)
    const provider = Effect.runSync(
      makeContinualIdentityProvider.pipe(
        Effect.provide(
          ConfigProvider.layer(
            ConfigProvider.fromEnvRecord({
              CONTINUAL_URL: "https://continual.example",
            })
          )
        )
      )
    )
    const identified = await Effect.runPromise(
      provider.identify(
        new Headers({
          "x-continual-app-runtime-assertion": "runtime-assertion",
          "x-continual-app-runtime-origin": "https://continual.example",
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
        redirect: "error",
        signal: expect.any(AbortSignal),
        headers: { authorization: "Bearer runtime-assertion" },
      }
    )
  })

  it("rejects caller-selected identity authorities before fetching", async () => {
    const fetch = vi.fn()
    vi.stubGlobal("fetch", fetch)
    const provider = Effect.runSync(
      makeContinualIdentityProvider.pipe(
        Effect.provide(
          ConfigProvider.layer(
            ConfigProvider.fromEnvRecord({
              CONTINUAL_URL: "https://continual.example",
            })
          )
        )
      )
    )
    await expect(
      Effect.runPromise(
        provider.identify(
          new Headers({
            "x-continual-app-runtime-assertion": "forged",
            "x-continual-app-runtime-origin": "https://untrusted.example",
          })
        )
      )
    ).rejects.toThrow()
    expect(fetch).not.toHaveBeenCalled()
  })

  it("uses the managed preview credential in a Continual sandbox", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        Response.json({ actorId: "us_123", email: null, name: "Person" })
      )
    vi.stubGlobal("fetch", fetch)
    const provider = Effect.runSync(
      makeContinualIdentityProvider.pipe(
        Effect.provide(
          ConfigProvider.layer(
            ConfigProvider.fromEnvRecord({
              CONTINUAL_EXECUTION_TOKEN: "execution-token",
              CONTINUAL_URL: "https://continual.example",
            })
          )
        )
      )
    )

    await Effect.runPromise(provider.identify(new Headers()))

    expect(fetch).toHaveBeenCalledWith(
      new URL("https://continual.example/api/apps/runtime/auth/preview-me"),
      {
        method: "GET",
        redirect: "error",
        signal: expect.any(AbortSignal),
        headers: { authorization: "Bearer execution-token" },
      }
    )
  })

  it("uses a stable local identity in the development server", async () => {
    vi.stubEnv("MODE", "development")
    const provider = Effect.runSync(
      makeContinualIdentityProvider.pipe(
        Effect.provide(
          ConfigProvider.layer(
            ConfigProvider.fromEnvRecord({
              CONTINUAL_URL: "https://continual.example",
            })
          )
        )
      )
    )
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
    const provider = Effect.runSync(
      makeContinualIdentityProvider.pipe(
        Effect.provide(
          ConfigProvider.layer(
            ConfigProvider.fromEnvRecord({
              CONTINUAL_URL: "https://continual.example",
            })
          )
        )
      )
    )
    await expect(
      Effect.runPromise(provider.identify(new Headers()))
    ).resolves.toBeNull()
  })
})
