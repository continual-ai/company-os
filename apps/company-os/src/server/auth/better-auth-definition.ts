import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2"
import { modelMetadata } from "@company/model/metadata"
import { betterAuth } from "better-auth/minimal"
import { genericOAuth } from "better-auth/plugins"
import { tanstackStartCookies } from "better-auth/tanstack-start"
import { Redacted } from "effect"

import type { AuthConfig } from "./auth-config"

type AuthDatabase = Parameters<typeof drizzleAdapter>[0]
type AuthDatabaseSchema = NonNullable<
  Parameters<typeof drizzleAdapter>[1]["schema"]
>

type OidcMetadata =
  | {
      readonly discoveryUrl: string
      readonly requireIdTokenVerification: true
    }
  | {
      readonly accountIssuer: string
      readonly authorizationUrl: string
      readonly tokenUrl: string
      readonly userInfoUrl: string
    }

interface BetterAuthDefinitionOptions {
  readonly config: AuthConfig
  readonly database: AuthDatabase
  readonly oidcMetadata?: OidcMetadata
  readonly schema?: AuthDatabaseSchema
}

/** Builds the private protocol engine; Company OS identity policy lives outside it. */
export function createBetterAuth({
  config,
  database,
  oidcMetadata = {
    discoveryUrl: config.oidc.discoveryUrl,
    requireIdTokenVerification: true,
  },
  schema,
}: BetterAuthDefinitionOptions) {
  return betterAuth({
    appName: modelMetadata.name,
    baseURL: config.baseUrl,
    secret: Redacted.value(config.secret),
    database: drizzleAdapter(database, {
      provider: "pg",
      schema,
      schemaName: "auth",
      transaction: true,
    }),
    account: {
      encryptOAuthTokens: true,
      accountLinking: { enabled: false },
    },
    advanced: {
      database: { joins: false },
      cookiePrefix: "company_os",
    },
    plugins: [
      genericOAuth({
        config: [
          {
            providerId: "oidc",
            name: config.oidc.name,
            clientId: config.oidc.clientId,
            clientSecret: Redacted.value(config.oidc.clientSecret),
            ...oidcMetadata,
            requireEmailVerification: true,
            scopes: ["openid", "email", "profile"],
          },
        ],
      }),
      tanstackStartCookies(),
    ],
    session: {
      deferSessionRefresh: true,
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
  })
}
