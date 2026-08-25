import { EmailAddress } from "@company/runtime"
import { Config, Context, Effect, Layer, Redacted } from "effect"

export interface AuthConfig {
  readonly baseUrl: string
  readonly bootstrapEmail: EmailAddress | undefined
  readonly oidc: {
    readonly clientId: string
    readonly clientSecret: Redacted.Redacted
    readonly discoveryUrl: string
    readonly name: string
  }
  readonly secret: Redacted.Redacted
}

export class AuthConfigurationError extends Error {
  override readonly name = "AuthConfigurationError"
}

function requiredSecret(
  value: Redacted.Redacted,
  name: string
): Redacted.Redacted {
  if (!Redacted.value(value).trim()) {
    throw new AuthConfigurationError(`${name} is required.`)
  }
  return value
}

function httpUrl(value: URL, name: string): string {
  if (value.protocol !== "http:" && value.protocol !== "https:") {
    throw new AuthConfigurationError(`${name} must use HTTP or HTTPS.`)
  }
  return value.toString().replace(/\/$/, "")
}

const deploymentConfig = Config.all({
  baseUrl: Config.url("BETTER_AUTH_URL"),
  bootstrapEmail: Config.string("AUTH_BOOTSTRAP_EMAIL").pipe(
    Config.withDefault("")
  ),
  oidc: Config.all({
    clientId: Config.nonEmptyString("AUTH_OIDC_CLIENT_ID"),
    clientSecret: Config.redacted("AUTH_OIDC_CLIENT_SECRET"),
    discoveryUrl: Config.url("AUTH_OIDC_DISCOVERY_URL"),
    name: Config.nonEmptyString("AUTH_OIDC_NAME").pipe(
      Config.withDefault("Single sign-on")
    ),
  }),
  secret: Config.redacted("BETTER_AUTH_SECRET"),
})

/** Loads and validates the standalone deployment contract that Continual may also inject. */
export const loadAuthConfig: Effect.Effect<
  AuthConfig,
  Config.ConfigError | AuthConfigurationError
> = Effect.gen(function* () {
  const config = yield* deploymentConfig
  const secret = requiredSecret(config.secret, "BETTER_AUTH_SECRET")
  if (Redacted.value(secret).length < 32) {
    throw new AuthConfigurationError(
      "BETTER_AUTH_SECRET must contain at least 32 characters."
    )
  }

  return yield* Effect.try({
    try: () => {
      const bootstrapEmail = config.bootstrapEmail.trim().toLowerCase()
      return {
        baseUrl: httpUrl(config.baseUrl, "BETTER_AUTH_URL"),
        bootstrapEmail:
          bootstrapEmail === "" ? undefined : EmailAddress(bootstrapEmail),
        oidc: {
          clientId: config.oidc.clientId,
          clientSecret: requiredSecret(
            config.oidc.clientSecret,
            "AUTH_OIDC_CLIENT_SECRET"
          ),
          discoveryUrl: httpUrl(
            config.oidc.discoveryUrl,
            "AUTH_OIDC_DISCOVERY_URL"
          ),
          name: config.oidc.name,
        },
        secret,
      }
    },
    catch: (error) =>
      error instanceof AuthConfigurationError
        ? error
        : new AuthConfigurationError(
            "Authentication configuration is invalid."
          ),
  })
})

/** Validated authentication settings supplied by the deployment boundary. */
export class AuthSettings extends Context.Service<AuthSettings>()(
  "@company/AuthSettings",
  { make: loadAuthConfig }
) {
  static readonly layer = Layer.effect(this, this.make)
}
