import { Context, Data, Effect, Layer, Option, Schema } from "effect"
import { createRemoteJWKSet, jwtVerify } from "jose"

import { AuthSettings, type IdentityKind } from "./auth-config"
import { localIdentityProfileId } from "./local-identity-session"

export interface AuthenticatedSubject {
  readonly email: string | undefined
  readonly issuer: string
  readonly kind: IdentityKind | undefined
  readonly name: string | undefined
  readonly subject: string
}

export interface VerifiedIdentityInvocation {
  /** Current identity that performs and is durably attributed to the operation. */
  readonly actor: AuthenticatedSubject
  /** Identity whose business authority is used, equal to actor unless delegated. */
  readonly authorizationSubject: AuthenticatedSubject
}

class InvalidIdentityAssertion extends Data.TaggedError(
  "InvalidIdentityAssertion"
)<{ readonly cause?: unknown; readonly reason: string }> {}

interface IdentityProviderService {
  readonly identify: (
    headers: Headers
  ) => Effect.Effect<
    VerifiedIdentityInvocation | null,
    InvalidIdentityAssertion
  >
}

type Claims = ReadonlyMap<string, unknown>

function stringClaim(payload: Claims, claim: string): string | undefined {
  return Option.match(
    Schema.decodeUnknownOption(Schema.String)(payload.get(claim)),
    {
      onNone: () => undefined,
      onSome: (value) => value.trim() || undefined,
    }
  )
}

function objectClaim(payload: Claims, claim: string): Claims | undefined {
  const decoded = Option.getOrUndefined(
    Schema.decodeUnknownOption(Schema.Record(Schema.String, Schema.Unknown))(
      payload.get(claim)
    )
  )
  return decoded === undefined ? undefined : new Map(Object.entries(decoded))
}

function assertionToken(headers: Headers, header: string): string | undefined {
  const value = headers.get(header)?.trim()
  if (!value) return undefined
  if (header === "authorization") {
    return value.startsWith("Bearer ") ? value.slice(7).trim() : undefined
  }
  return value
}

function identityKind(
  claims: Claims,
  kindClaim: string,
  fallback: IdentityKind | undefined
): IdentityKind | undefined {
  const assertedKind = stringClaim(claims, kindClaim)
  if (
    assertedKind !== undefined &&
    assertedKind !== "user" &&
    assertedKind !== "serviceAccount"
  ) {
    throw new InvalidIdentityAssertion({
      reason: `The '${kindClaim}' claim is not a supported identity kind.`,
    })
  }
  return assertedKind ?? fallback
}

function identity(
  claims: Claims,
  fallbackIssuer: string,
  kindClaim: string,
  defaultIdentityKind: IdentityKind | undefined
): AuthenticatedSubject {
  const subject = stringClaim(claims, "sub")
  if (subject === undefined) {
    throw new InvalidIdentityAssertion({
      reason: "The identity assertion has no non-empty subject.",
    })
  }
  return {
    email: stringClaim(claims, "email"),
    issuer: stringClaim(claims, "iss") ?? fallbackIssuer,
    kind: identityKind(claims, kindClaim, defaultIdentityKind),
    name: stringClaim(claims, "name"),
    subject,
  }
}

const make = Effect.gen(function* () {
  const config = yield* AuthSettings
  const provider = config.provider

  if (provider.kind === "local") {
    const identify: IdentityProviderService["identify"] = (headers) => {
      const profileId = localIdentityProfileId(headers, provider.cookieName)
      const profile = provider.profiles.find(({ id }) => id === profileId)
      if (profile === undefined) return Effect.succeed(null)
      const subject = {
        email: profile.email,
        issuer: provider.issuer,
        kind: "user" as const,
        name: profile.name,
        subject: profile.subject,
      } satisfies AuthenticatedSubject
      return Effect.succeed({ actor: subject, authorizationSubject: subject })
    }
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
          algorithms: [...provider.algorithms],
          audience: provider.audience,
          clockTolerance: provider.clockToleranceSeconds,
          issuer: provider.issuer,
          maxTokenAge: provider.maxTokenAge,
          requiredClaims: ["exp", "iat", "sub"],
        }),
      catch: (cause) =>
        new InvalidIdentityAssertion({
          cause,
          reason: "The identity assertion could not be verified.",
        }),
    })

    return yield* Effect.try({
      try: () => {
        const claims = new Map(Object.entries(payload))
        const authorizationSubject = identity(
          claims,
          provider.issuer,
          provider.kindClaim,
          provider.defaultIdentityKind
        )
        if (claims.has("act") && objectClaim(claims, "act") === undefined) {
          throw new InvalidIdentityAssertion({
            reason: "The 'act' claim must be an object.",
          })
        }
        const actorClaims = objectClaim(claims, "act")
        const actorIssuer =
          actorClaims === undefined
            ? undefined
            : stringClaim(actorClaims, "iss")
        if (actorIssuer !== undefined && actorIssuer !== provider.issuer) {
          throw new InvalidIdentityAssertion({
            reason: "The 'act.iss' claim must match the assertion issuer.",
          })
        }
        const actor =
          actorClaims === undefined
            ? authorizationSubject
            : identity(
                actorClaims,
                provider.issuer,
                provider.kindClaim,
                provider.defaultIdentityKind
              )
        return { actor, authorizationSubject }
      },
      catch: (cause) =>
        cause instanceof InvalidIdentityAssertion
          ? cause
          : new InvalidIdentityAssertion({
              cause,
              reason: "The identity assertion claims are invalid.",
            }),
    })
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
