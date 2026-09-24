import { Effect } from "effect"
import { afterEach, expect, it, vi } from "vitest"

import { makeContinualIdentityProvider } from "#/app/server/auth/identity-provider.ts"

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

it.each([
  { actorId: "us_test", email: "person@example.com", kind: "user" },
  { actorId: "sa_test", email: null, kind: "serviceAccount" },
])(
  "maps the SDK's public actor contract: $kind",
  async ({ actorId, email, kind }) => {
    vi.stubEnv("CONTINUAL_URL", "https://continual.example")
    vi.stubEnv("CONTINUAL_PROJECT_ID", "prj_test")
    const fetch = vi
      .fn()
      .mockResolvedValue(Response.json({ actorId, email, name: "Person" }))
    vi.stubGlobal("fetch", fetch)
    const provider = Effect.runSync(makeContinualIdentityProvider)
    expect(
      await Effect.runPromise(
        provider.identify(
          new Headers({
            "x-continual-app-runtime-assertion": "assertion",
            "x-continual-app-runtime-origin": "https://continual.example",
          })
        )
      )
    ).toMatchObject({
      subject: actorId,
      preferredIdentityId: actorId,
      kind,
      email: email ?? undefined,
    })
    expect(fetch.mock.calls[0]?.[0].toString()).toContain(
      "/api/apps/runtime/auth/me"
    )
    expect(fetch.mock.calls[0]?.[1].headers.authorization).toBe(
      "Bearer assertion"
    )
  }
)

it("uses the SDK preview verifier with the managed execution credential", async () => {
  vi.stubEnv("CONTINUAL_URL", "https://continual.example")
  vi.stubEnv("CONTINUAL_PROJECT_ID", "prj_test")
  vi.stubEnv("CONTINUAL_EXECUTION_TOKEN", "preview-token")
  const fetch = vi.fn().mockResolvedValue(
    Response.json({
      actorId: "us_test",
      email: "a@example.com",
      name: "Person",
    })
  )
  vi.stubGlobal("fetch", fetch)
  const provider = Effect.runSync(makeContinualIdentityProvider)
  await Effect.runPromise(provider.identify(new Headers()))
  expect(fetch.mock.calls[0]?.[0].toString()).toContain(
    "/api/apps/runtime/auth/preview-me"
  )
})

it("fails closed when the platform refuses admission, including in development", async () => {
  vi.stubEnv("MODE", "development")
  vi.stubEnv("CONTINUAL_URL", "https://continual.example")
  vi.stubEnv("CONTINUAL_PROJECT_ID", "prj_test")
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(null, { status: 403 }))
  )
  const provider = Effect.runSync(makeContinualIdentityProvider)
  await expect(
    Effect.runPromise(
      provider.identify(
        new Headers({ "x-continual-app-runtime-assertion": "bad" })
      )
    )
  ).rejects.toMatchObject({ reason: "Continual project access is required." })
})
