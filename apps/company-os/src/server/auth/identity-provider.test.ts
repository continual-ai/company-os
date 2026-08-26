import { createServer, type Server } from "node:http"

import { Effect, Layer, Schema } from "effect"
import {
  exportJWK,
  generateKeyPair,
  SignJWT,
  type CryptoKey,
  type JWK,
} from "jose"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { AuthSettings, type AuthConfig } from "./auth-config"
import { IdentityProvider } from "./identity-provider"

let privateKey: CryptoKey
let publicJwk: JWK
let server: Server
let jwksUrl: URL

beforeAll(async () => {
  const keys = await generateKeyPair("RS256")
  privateKey = keys.privateKey
  publicJwk = {
    ...(await exportJWK(keys.publicKey)),
    alg: "RS256",
    kid: "test",
  }
  server = createServer((_request, response) => {
    response.setHeader("content-type", "application/json")
    response.end(JSON.stringify({ keys: [publicJwk] }))
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = Schema.decodeUnknownSync(
    Schema.Struct({ port: Schema.Number })
  )(server.address())
  jwksUrl = new URL(`http://127.0.0.1:${address.port}/jwks`)
})

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error === undefined ? resolve() : reject(error)))
  )
})

function provider() {
  const config: AuthConfig = {
    provider: {
      algorithms: ["RS256"],
      audience: "company-os",
      clockToleranceSeconds: 30,
      defaultIdentityKind: undefined,
      header: "x-company-identity",
      issuer: "https://identity.example.com",
      jwksUrl,
      kind: "jwt",
      kindClaim: "identity_type",
      maxTokenAge: "10m",
      profile: "standard",
    },
    provisioningRole: "operator",
  }
  return IdentityProvider.pipe(
    Effect.provide(
      IdentityProvider.layer.pipe(
        Layer.provide(Layer.succeed(AuthSettings, config))
      )
    )
  )
}

function assertion(input?: {
  readonly actor?: {
    readonly kind?: string
    readonly subject: string
  }
  readonly audience?: string
  readonly kind?: string
  readonly omitIssuedAt?: boolean
  readonly subject?: string
}) {
  let token = new SignJWT({
    act:
      input?.actor === undefined
        ? undefined
        : {
            identity_type: input.actor.kind ?? "serviceAccount",
            name: "Portfolio agent",
            sub: input.actor.subject,
          },
    email: "ada@example.com",
    identity_type: input?.kind ?? "user",
    name: "Ada Lovelace",
  })
    .setProtectedHeader({ alg: "RS256", kid: "test" })
    .setExpirationTime("5m")
    .setIssuer("https://identity.example.com")
    .setAudience(input?.audience ?? "company-os")
    .setSubject(input?.subject ?? "user_ada")
  if (input?.omitIssuedAt !== true) token = token.setIssuedAt()
  return token.sign(privateKey)
}

describe("IdentityProvider", () => {
  it("returns no subject when the gateway assertion is absent", async () => {
    const identityProvider = await Effect.runPromise(provider())
    await expect(
      Effect.runPromise(identityProvider.identify(new Headers()))
    ).resolves.toBeNull()
  })

  it("verifies and normalizes a signed identity assertion", async () => {
    const identityProvider = await Effect.runPromise(provider())
    const token = await assertion()
    await expect(
      Effect.runPromise(
        identityProvider.identify(new Headers({ "x-company-identity": token }))
      )
    ).resolves.toEqual({
      actor: {
        email: "ada@example.com",
        issuer: "https://identity.example.com",
        kind: "user",
        name: "Ada Lovelace",
        subject: "user_ada",
      },
      authorizationSubject: {
        email: "ada@example.com",
        issuer: "https://identity.example.com",
        kind: "user",
        name: "Ada Lovelace",
        subject: "user_ada",
      },
    })
  })

  it("preserves RFC 8693 delegated actor and subject identities", async () => {
    const identityProvider = await Effect.runPromise(provider())
    const token = await assertion({
      actor: { subject: "service_portfolio_agent" },
    })
    await expect(
      Effect.runPromise(
        identityProvider.identify(new Headers({ "x-company-identity": token }))
      )
    ).resolves.toMatchObject({
      actor: {
        kind: "serviceAccount",
        name: "Portfolio agent",
        subject: "service_portfolio_agent",
      },
      authorizationSubject: { kind: "user", subject: "user_ada" },
    })
  })

  it("rejects invalid audiences and unsupported identity kinds", async () => {
    const identityProvider = await Effect.runPromise(provider())
    await expect(
      Effect.runPromise(
        identityProvider.identify(
          new Headers({
            "x-company-identity": await assertion({ audience: "other" }),
          })
        )
      )
    ).rejects.toMatchObject({ _tag: "InvalidIdentityAssertion" })
    await expect(
      Effect.runPromise(
        identityProvider.identify(
          new Headers({
            "x-company-identity": await assertion({ kind: "robot" }),
          })
        )
      )
    ).rejects.toMatchObject({ _tag: "InvalidIdentityAssertion" })
  })

  it("requires issued-at and non-empty subject claims", async () => {
    const identityProvider = await Effect.runPromise(provider())
    await expect(
      Effect.runPromise(
        identityProvider.identify(
          new Headers({
            "x-company-identity": await assertion({ omitIssuedAt: true }),
          })
        )
      )
    ).rejects.toMatchObject({ _tag: "InvalidIdentityAssertion" })
    await expect(
      Effect.runPromise(
        identityProvider.identify(
          new Headers({
            "x-company-identity": await assertion({ subject: " " }),
          })
        )
      )
    ).rejects.toMatchObject({ _tag: "InvalidIdentityAssertion" })
  })
})
