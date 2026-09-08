import {
  IdentityProvider,
  InvalidIdentityAssertion,
  type AuthenticatedSubject,
} from "@company/runtime/server/auth/identity-provider"
import { Config, Effect, Layer } from "effect"
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose"

/** Verifies externally issued access tokens; issuer and subject identify the local principal, never token role claims. */
export function makeJwtIdentityProvider(config: {
  issuer: string
  audience: string
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
      const subject: AuthenticatedSubject = {
        issuer: config.issuer,
        subject: payload.sub,
        kind: "user",
        name: typeof payload.name === "string" ? payload.name : undefined,
        email: typeof payload.email === "string" ? payload.email : undefined,
      }
      return { actor: subject, authorizationSubject: subject }
    }),
  }
}

export const jwtIdentityProviderLayer = Layer.effect(
  IdentityProvider,
  Effect.gen(function* () {
    const issuer = yield* Config.string("AUTH_JWT_ISSUER")
    const audience = yield* Config.string("AUTH_JWT_AUDIENCE")
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
      resolveKey: createRemoteJWKSet(url, { timeoutDuration: 5000 }),
    })
  })
)
