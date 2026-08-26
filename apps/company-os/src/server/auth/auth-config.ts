import { Config, Context, Effect, Layer } from "effect"

export type IdentityKind = "serviceAccount" | "user"
type ProvisioningRole = "administrator" | "none" | "operator"
type JwtAlgorithm = "EdDSA" | "ES256" | "PS256" | "RS256"

interface LocalIdentityConfig {
  readonly email: string
  readonly kind: "local"
  readonly name: string
  readonly subject: string
}

interface JwtIdentityConfig {
  readonly algorithms: ReadonlyArray<JwtAlgorithm>
  readonly audience: string
  readonly clockToleranceSeconds: number
  readonly defaultIdentityKind: IdentityKind | undefined
  readonly header: string
  readonly issuer: string
  readonly jwksUrl: URL
  readonly kind: "jwt"
  readonly kindClaim: string
  readonly maxTokenAge: string
  readonly profile: "google-iap" | "standard"
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

function algorithms(value: string): ReadonlyArray<JwtAlgorithm> {
  const configured = [...new Set(value.split(",").map((item) => item.trim()))]
  const result: Array<JwtAlgorithm> = []
  for (const algorithm of configured) {
    if (
      algorithm !== "EdDSA" &&
      algorithm !== "ES256" &&
      algorithm !== "PS256" &&
      algorithm !== "RS256"
    ) {
      throw new AuthConfigurationError(
        "AUTH_JWT_ALGORITHMS must contain only EdDSA, ES256, PS256, or RS256."
      )
    }
    result.push(algorithm)
  }
  return result
}

function clockTolerance(value: number): number {
  if (value < 0 || value > 300) {
    throw new AuthConfigurationError(
      "AUTH_JWT_CLOCK_TOLERANCE_SECONDS must be between 0 and 300."
    )
  }
  return value
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

  if (mode === "google-iap") {
    const iap = yield* Config.all({
      audience: Config.nonEmptyString("AUTH_IAP_AUDIENCE"),
      role: Config.nonEmptyString("AUTH_JIT_ROLE"),
    })
    return {
      provider: {
        algorithms: ["ES256"],
        audience: iap.audience,
        clockToleranceSeconds: 30,
        defaultIdentityKind: "user",
        header: "x-goog-iap-jwt-assertion",
        issuer: "https://cloud.google.com/iap",
        jwksUrl: new URL("https://www.gstatic.com/iap/verify/public_key-jwk"),
        kind: "jwt",
        kindClaim: "identity_type",
        maxTokenAge: "11m",
        profile: "google-iap",
      },
      provisioningRole: provisioningRole(iap.role),
    }
  }

  if (mode === "jwt") {
    const jwt = yield* Config.all({
      algorithms: Config.nonEmptyString("AUTH_JWT_ALGORITHMS").pipe(
        Config.withDefault("RS256,ES256,EdDSA")
      ),
      audience: Config.nonEmptyString("AUTH_JWT_AUDIENCE"),
      clockToleranceSeconds: Config.int(
        "AUTH_JWT_CLOCK_TOLERANCE_SECONDS"
      ).pipe(Config.withDefault(30)),
      defaultIdentityKind: Config.string("AUTH_JWT_DEFAULT_IDENTITY_KIND").pipe(
        Config.withDefault("")
      ),
      header: Config.nonEmptyString("AUTH_JWT_HEADER").pipe(
        Config.withDefault("x-company-identity")
      ),
      issuer: Config.nonEmptyString("AUTH_JWT_ISSUER"),
      jwksUrl: Config.url("AUTH_JWT_JWKS_URL"),
      kindClaim: Config.nonEmptyString("AUTH_JWT_KIND_CLAIM").pipe(
        Config.withDefault("identity_type")
      ),
      maxTokenAge: Config.nonEmptyString("AUTH_JWT_MAX_AGE").pipe(
        Config.withDefault("10m")
      ),
      role: Config.nonEmptyString("AUTH_JIT_ROLE"),
    })
    return {
      provider: {
        algorithms: algorithms(jwt.algorithms),
        audience: jwt.audience,
        clockToleranceSeconds: clockTolerance(jwt.clockToleranceSeconds),
        defaultIdentityKind: identityKind(jwt.defaultIdentityKind),
        header: jwt.header.toLowerCase(),
        issuer: jwt.issuer,
        jwksUrl: httpUrl(jwt.jwksUrl, "AUTH_JWT_JWKS_URL"),
        kind: "jwt",
        kindClaim: jwt.kindClaim,
        maxTokenAge: jwt.maxTokenAge,
        profile: "standard",
      },
      provisioningRole: provisioningRole(jwt.role),
    }
  }

  throw new AuthConfigurationError(
    "AUTH_MODE must be 'local', 'jwt', or 'google-iap'."
  )
})

/** Validated deployment settings for local development or verified JWT assertions. */
export class AuthSettings extends Context.Service<AuthSettings>()(
  "@company/AuthSettings",
  { make: loadAuthConfig }
) {
  static readonly layer = Layer.effect(this, this.make)
}
