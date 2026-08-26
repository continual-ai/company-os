import { Context, Data, Effect, Layer, Option, Schema } from "effect"
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose"

import { AuthSettings, type IdentityKind } from "./auth-config"

export interface AuthenticatedSubject {
  readonly email: string | undefined
  readonly issuer: string
  readonly kind: IdentityKind | undefined
  readonly name: string | undefined
  readonly subject: string
}

class InvalidIdentityAssertion extends Data.TaggedError(
  "InvalidIdentityAssertion"
)<{ readonly cause?: unknown; readonly reason: string }> {}

interface IdentityProviderService {
  readonly identify: (
    headers: Headers
  ) => Effect.Effect<AuthenticatedSubject | null, InvalidIdentityAssertion>
}

function stringClaim(payload: JWTPayload, claim: string): string | undefined {
  return Option.match(
    Schema.decodeUnknownOption(Schema.String)(payload[claim]),
    {
      onNone: () => undefined,
      onSome: (value) => value.trim() || undefined,
    }
  )
}

function assertionToken(headers: Headers, header: string): string | undefined {
  const value = headers.get(header)?.trim()
  if (!value) return undefined
  if (header === "authorization") {
    return value.startsWith("Bearer ") ? value.slice(7).trim() : undefined
  }
  return value
}

const make = Effect.gen(function* () {
  const config = yield* AuthSettings
  const provider = config.provider

  if (provider.kind === "local") {
    const identify: IdentityProviderService["identify"] = (_headers) =>
      Effect.succeed({
        email: provider.email,
        issuer: "urn:company-os:local",
        kind: "user" as const,
        name: provider.name,
        subject: provider.subject,
      } satisfies AuthenticatedSubject)
    return { identify } satisfies IdentityProviderService
  }

  const jwks = createRemoteJWKSet(provider.jwksUrl)
  const identify: IdentityProviderService["identify"] = Effect.fn(
    "@company/IdentityProvider.identifyJwt"
  )(function* (headers: Headers) {
    const assertion = headers.get(provider.header)?.trim()
    if (!assertion) return null
    const token = assertionToken(headers, provider.header)
    if (token === undefined) {
      return yield* Effect.fail(
        new InvalidIdentityAssertion({
          reason: `The '${provider.header}' header is malformed.`,
        })
      )
    }

    const { payload } = yield* Effect.tryPromise({
      try: () =>
        jwtVerify(token, jwks, {
          audience: provider.audience,
          issuer: provider.issuer,
        }),
      catch: (cause) =>
        new InvalidIdentityAssertion({
          cause,
          reason: "The identity assertion could not be verified.",
        }),
    })
    if (payload.sub === undefined) {
      return yield* Effect.fail(
        new InvalidIdentityAssertion({
          reason: "The identity assertion has no subject.",
        })
      )
    }

    const assertedKind = stringClaim(payload, provider.kindClaim)
    if (
      assertedKind !== undefined &&
      assertedKind !== "user" &&
      assertedKind !== "serviceAccount"
    ) {
      return yield* Effect.fail(
        new InvalidIdentityAssertion({
          reason: `The '${provider.kindClaim}' claim is not a supported identity kind.`,
        })
      )
    }

    const email = stringClaim(payload, "email")
    const kind = assertedKind ?? provider.defaultIdentityKind
    const name = stringClaim(payload, "name")
    return {
      email,
      issuer: provider.issuer,
      kind,
      name,
      subject: payload.sub,
    } satisfies AuthenticatedSubject
  })
  return { identify } satisfies IdentityProviderService
})

/** Verifies deployment identity assertions without owning credentials or sessions. */
export class IdentityProvider extends Context.Service<IdentityProvider>()(
  "@company/IdentityProvider",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
