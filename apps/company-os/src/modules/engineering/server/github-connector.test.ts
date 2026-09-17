import { Effect } from "effect"
import { expect, it, vi } from "vitest"

import {
  GitHubClients,
  githubRequest,
} from "#/modules/engineering/server/github-connector.ts"
import { RecordId } from "#/runtime/model/index.ts"

const json = (
  body: unknown,
  status = 200,
  headers: Record<string, string> = {}
) => Response.json(body, { status, headers })

it("shares the default request limit across clients for one connection", async () => {
  const clients = await Effect.runPromise(GitHubClients.make)
  const id = RecordId("connection")("connection_shared")
  const first = clients.create("test-token", id)
  const second = clients.create("test-token", id)
  const other = clients.create(
    "other-token",
    RecordId("connection")("connection_other")
  )
  let release: (() => void) | undefined
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  let active = 0
  let maximum = 0
  let started = 0
  const fetch = async () => {
    started++
    maximum = Math.max(maximum, ++active)
    await gate
    active--
    return json({})
  }
  const requests = Array.from({ length: 14 }, (_, index) =>
    (index % 2 ? first : second).rest.repos.get({
      owner: "test",
      repo: "repo",
      request: { fetch },
    })
  )
  try {
    await vi.waitFor(() => expect(started).toBe(10))
    await other.rest.repos.get({
      owner: "test",
      repo: "repo",
      request: { fetch: async () => json({}) },
    })
    expect(started).toBe(10)
  } finally {
    release?.()
    await Promise.all(requests)
  }
  expect(started).toBe(14)
  expect(maximum).toBe(10)
})

it.each(["primary", "secondary"] as const)(
  "retries a %s limit once, then returns a sanitized controller failure",
  async (kind) => {
    const clients = await Effect.runPromise(GitHubClients.make)
    const client = clients.create(
      "test-token",
      RecordId("connection")(`connection_${kind}`)
    )
    let attempts = 0
    const times: number[] = []
    const result = await Effect.runPromise(
      githubRequest((signal) =>
        client.rest.repos.get({
          owner: "test",
          repo: "repo",
          request: {
            signal,
            fetch: async () => {
              attempts++
              times.push(Date.now())
              return kind === "primary"
                ? json(
                    { message: "API rate limit exceeded; private detail" },
                    403,
                    {
                      "x-ratelimit-remaining": "0",
                      "x-ratelimit-reset": String(
                        Math.floor(Date.now() / 1000) - 1
                      ),
                    }
                  )
                : json(
                    {
                      message:
                        "You have exceeded a secondary rate limit; private detail",
                    },
                    403,
                    { "retry-after": "1" }
                  )
            },
          },
        })
      ).pipe(Effect.flip)
    )
    expect(attempts).toBe(2)
    expect(result).toMatchObject({
      _tag: "ConnectionError",
      reason: "rateLimit",
    })
    expect(JSON.stringify(result)).not.toContain("private detail")
    if (kind === "secondary")
      expect(times[1]! - times[0]!).toBeGreaterThanOrEqual(1000)
  }
)

it("hands long cooldowns back to the controller without an in-process retry", async () => {
  const clients = await Effect.runPromise(GitHubClients.make)
  const client = clients.create(
    "test-token",
    RecordId("connection")("connection_long_wait")
  )
  let attempts = 0
  const failure = await Effect.runPromise(
    githubRequest((signal) =>
      client.rest.repos.get({
        owner: "test",
        repo: "repo",
        request: {
          signal,
          fetch: async () => {
            attempts++
            return json(
              { message: "You have exceeded a secondary rate limit" },
              403,
              { "retry-after": "120" }
            )
          },
        },
      })
    ).pipe(Effect.flip)
  )
  expect(attempts).toBe(1)
  expect(failure).toMatchObject({ reason: "rateLimit", retryAfter: 120 })
})

it("recognizes secondary-limit responses without headers as retryable", async () => {
  const error = Object.assign(
    new Error("You have exceeded a secondary rate limit"),
    {
      status: 403,
      response: { headers: {} },
    }
  )
  const failure = await Effect.runPromise(
    githubRequest(() => Promise.reject(error)).pipe(Effect.flip)
  )
  expect(failure).toMatchObject({ reason: "rateLimit", retryAfter: 60 })
})
