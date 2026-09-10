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
        kind: "user",
        projectId: "project_test",
        projectAccess: true,
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
              CONTINUAL_PROJECT_ID: "project_test",
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

    expect(identified).toMatchObject({
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
              CONTINUAL_PROJECT_ID: "project_test",
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
    const fetch = vi.fn().mockResolvedValue(
      Response.json({
        actorId: "us_123",
        kind: "user",
        projectId: "project_test",
        projectAccess: true,
        email: null,
        name: "Person",
      })
    )
    vi.stubGlobal("fetch", fetch)
    const provider = Effect.runSync(
      makeContinualIdentityProvider.pipe(
        Effect.provide(
          ConfigProvider.layer(
            ConfigProvider.fromEnvRecord({
              CONTINUAL_EXECUTION_TOKEN: "execution-token",
              CONTINUAL_URL: "https://continual.example",
              CONTINUAL_PROJECT_ID: "project_test",
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
              CONTINUAL_PROJECT_ID: "project_test",
            })
          )
        )
      )
    )
    await expect(
      Effect.runPromise(provider.identify(new Headers()))
    ).resolves.toEqual({
      email: "developer@company.test",
      issuer: "local-development",
      kind: "user",
      name: "Local Developer",
      subject: "default",
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
              CONTINUAL_PROJECT_ID: "project_test",
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

it.each([
  { projectId: "other-project", projectAccess: true, kind: "user" },
  { projectId: "project_test", projectAccess: false, kind: "user" },
  { projectId: "project_test", kind: "serviceAccount" },
  {},
])(
  "rejects identities without explicit admission to this project: %j",
  async (claims) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          actorId: "us_123",
          name: "Person",
          email: "person@example.test",
          ...claims,
        })
      )
    )
    const provider = Effect.runSync(
      makeContinualIdentityProvider.pipe(
        Effect.provide(
          ConfigProvider.layer(
            ConfigProvider.fromEnvRecord({
              CONTINUAL_URL: "https://continual.example",
              CONTINUAL_PROJECT_ID: "project_test",
            })
          )
        )
      )
    )
    await expect(
      Effect.runPromise(
        provider.identify(
          new Headers({ "x-continual-app-runtime-assertion": "assertion" })
        )
      )
    ).rejects.toThrow()
  }
)

it("preserves an explicitly admitted service account without inventing a user", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      Response.json({
        actorId: "sa_123",
        kind: "serviceAccount",
        name: "Agent",
        email: null,
        projectId: "project_test",
        projectAccess: true,
      })
    )
  )
  const provider = Effect.runSync(
    makeContinualIdentityProvider.pipe(
      Effect.provide(
        ConfigProvider.layer(
          ConfigProvider.fromEnvRecord({
            CONTINUAL_URL: "https://continual.example",
            CONTINUAL_PROJECT_ID: "project_test",
          })
        )
      )
    )
  )
  expect(
    await Effect.runPromise(
      provider.identify(
        new Headers({ "x-continual-app-runtime-assertion": "assertion" })
      )
    )
  ).toMatchObject({ kind: "serviceAccount", preferredIdentityId: "sa_123" })
})
