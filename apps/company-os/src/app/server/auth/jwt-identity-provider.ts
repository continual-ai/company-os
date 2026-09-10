import { Config, Effect, Layer } from "effect"
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose"

import {
  IdentityProvider,
  InvalidIdentityAssertion,
  type AuthenticatedSubject,
} from "#/runtime/server/auth/identity-provider.ts"

/** Verifies externally issued access tokens; issuer and subject identify the local principal, never token role claims. */
export function makeJwtIdentityProvider(config: {
  issuer: string
  audience: string
  projectId: string
  resolveKey: JWTVerifyGetKey
}) {
  return {
    identify: Effect.fn("@company/JwtIdentityProvider.identify")(function* (
      headers: Headers
    ) {
      const authorization = headers.get("authorization")
      if (authorization === null) return null
      const token = /^Bearer ([^\s]+)$/i.exec(authorization)?.[1]
      if (!token)
        return yield* Effect.fail(
          new InvalidIdentityAssertion({
            reason: "Expected a bearer access token.",
          })
        )
      const { payload } = yield* Effect.tryPromise({
        try: () =>
          jwtVerify(token, config.resolveKey, {
            issuer: config.issuer,
            audience: config.audience,
            algorithms: ["RS256", "ES256"],
            requiredClaims: ["sub", "exp", "iat"],
            clockTolerance: 5,
          }),
        catch: () =>
          new InvalidIdentityAssertion({
            reason: "The access token is invalid or expired.",
          }),
      })
      if (!payload.sub?.trim())
        return yield* Effect.fail(
          new InvalidIdentityAssertion({
            reason: "The token subject is missing.",
          })
        )
      if (
        payload.project_id !== config.projectId ||
        payload.project_access !== true ||
        !config.projectId ||
        (payload.kind !== "user" && payload.kind !== "serviceAccount")
      ) {
        return yield* Effect.fail(
          new InvalidIdentityAssertion({
            reason: "The token does not grant access to this project.",
          })
        )
      }
      const subject: AuthenticatedSubject = {
        issuer: config.issuer,
        subject: payload.sub,
        kind: payload.kind,
        name: typeof payload.name === "string" ? payload.name : undefined,
        email: typeof payload.email === "string" ? payload.email : undefined,
      }
      return subject
    }),
  }
}

export const jwtIdentityProviderLayer = Layer.effect(
  IdentityProvider,
  Effect.gen(function* () {
    const issuer = yield* Config.string("AUTH_JWT_ISSUER")
    const audience = yield* Config.string("AUTH_JWT_AUDIENCE")
    const projectId = yield* Config.string("AUTH_PROJECT_ID")
    const jwksUrl = yield* Config.string("AUTH_JWT_JWKS_URL")
    const url = yield* Effect.try(() => new URL(jwksUrl))
    if (url.protocol !== "https:" || !issuer.trim() || !audience.trim())
      return yield* Effect.fail(
        new Error(
          "JWT identity requires an issuer, audience, and HTTPS JWKS URL."
        )
      )
    return makeJwtIdentityProvider({
      issuer,
      audience,
      projectId,
      resolveKey: createRemoteJWKSet(url, { timeoutDuration: 5000 }),
    })
  })
)
