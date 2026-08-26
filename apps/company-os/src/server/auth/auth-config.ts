import { Config, Context, Effect, Layer } from "effect"

export type IdentityKind = "serviceAccount" | "user"
type ProvisioningRole = "administrator" | "none" | "operator"

interface LocalIdentityConfig {
  readonly email: string
  readonly kind: "local"
  readonly name: string
  readonly subject: string
}

interface JwtIdentityConfig {
  readonly audience: string
  readonly defaultIdentityKind: IdentityKind | undefined
  readonly header: string
  readonly issuer: string
  readonly jwksUrl: URL
  readonly kind: "jwt"
  readonly kindClaim: string
}

export interface AuthConfig {
  readonly provider: LocalIdentityConfig | JwtIdentityConfig
  readonly provisioningRole: ProvisioningRole
}

export class AuthConfigurationError extends Error {
  override readonly name = "AuthConfigurationError"
}

function identityKind(value: string): IdentityKind | undefined {
  if (value === "") return undefined
  if (value === "user" || value === "serviceAccount") return value
  throw new AuthConfigurationError(
    "AUTH_JWT_DEFAULT_IDENTITY_KIND must be 'user' or 'serviceAccount'."
  )
}

function provisioningRole(value: string): ProvisioningRole {
  if (value === "administrator" || value === "none" || value === "operator") {
    return value
  }
  throw new AuthConfigurationError(
    "AUTH_JIT_ROLE must be 'administrator', 'operator', or 'none'."
  )
}

function httpUrl(value: URL, name: string): URL {
  if (value.protocol !== "http:" && value.protocol !== "https:") {
    throw new AuthConfigurationError(`${name} must use HTTP or HTTPS.`)
  }
  return value
}

const authMode = Config.string("AUTH_MODE").pipe(Config.withDefault("local"))

/** Loads the identity assertion boundary without owning credentials or sessions. */
export const loadAuthConfig: Effect.Effect<
  AuthConfig,
  Config.ConfigError | AuthConfigurationError
> = Effect.gen(function* () {
  const mode = yield* authMode
  const environment = yield* Config.string("NODE_ENV").pipe(
    Config.withDefault("development")
  )
  if (mode === "local") {
    if (environment === "production") {
      throw new AuthConfigurationError(
        "AUTH_MODE=local is not allowed when NODE_ENV=production."
      )
    }
    const local = yield* Config.all({
      email: Config.nonEmptyString("AUTH_LOCAL_EMAIL").pipe(
        Config.withDefault("developer@company.test")
      ),
      name: Config.nonEmptyString("AUTH_LOCAL_NAME").pipe(
        Config.withDefault("Local developer")
      ),
      role: Config.string("AUTH_JIT_ROLE").pipe(
        Config.withDefault("administrator")
      ),
      subject: Config.nonEmptyString("AUTH_LOCAL_SUBJECT").pipe(
        Config.withDefault("developer")
      ),
    })
    return {
      provider: {
        email: local.email,
        kind: "local",
        name: local.name,
        subject: local.subject,
      },
      provisioningRole: provisioningRole(local.role),
    }
  }

  if (mode === "jwt") {
    const jwt = yield* Config.all({
      audience: Config.nonEmptyString("AUTH_JWT_AUDIENCE"),
      defaultIdentityKind: Config.string("AUTH_JWT_DEFAULT_IDENTITY_KIND").pipe(
        Config.withDefault("")
      ),
      header: Config.nonEmptyString("AUTH_JWT_HEADER").pipe(
        Config.withDefault("x-company-identity")
      ),
      issuer: Config.nonEmptyString("AUTH_JWT_ISSUER"),
      jwksUrl: Config.url("AUTH_JWT_JWKS_URL"),
      kindClaim: Config.nonEmptyString("AUTH_JWT_KIND_CLAIM").pipe(
        Config.withDefault("actor_kind")
      ),
      role: Config.string("AUTH_JIT_ROLE").pipe(Config.withDefault("operator")),
    })
    return {
      provider: {
        audience: jwt.audience,
        defaultIdentityKind: identityKind(jwt.defaultIdentityKind),
        header: jwt.header.toLowerCase(),
        issuer: jwt.issuer,
        jwksUrl: httpUrl(jwt.jwksUrl, "AUTH_JWT_JWKS_URL"),
        kind: "jwt",
        kindClaim: jwt.kindClaim,
      },
      provisioningRole: provisioningRole(jwt.role),
    }
  }

  throw new AuthConfigurationError("AUTH_MODE must be 'local' or 'jwt'.")
})

/** Validated deployment settings for local development or verified JWT assertions. */
export class AuthSettings extends Context.Service<AuthSettings>()(
  "@company/AuthSettings",
  { make: loadAuthConfig }
) {
  static readonly layer = Layer.effect(this, this.make)
}
