import { ConfigProvider, Effect } from "effect"
import { afterEach, describe, expect, it, vi } from "vitest"

import { IdentityProvider } from "./identity-provider"

afterEach(() => {
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
    const provider = Effect.runSync(IdentityProvider.make)
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
        headers: { authorization: "Bearer runtime-assertion" },
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
    const provider = Effect.runSync(
      IdentityProvider.make.pipe(
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
        headers: { authorization: "Bearer execution-token" },
      }
    )
  })

  it("treats requests without a provider credential as anonymous", async () => {
    const provider = Effect.runSync(IdentityProvider.make)
    await expect(
      Effect.runPromise(provider.identify(new Headers()))
    ).resolves.toBeNull()
  })
})
