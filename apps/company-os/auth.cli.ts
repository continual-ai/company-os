import { drizzle } from "drizzle-orm/node-postgres"
import { Redacted } from "effect"

import { createBetterAuth } from "./src/server/auth/better-auth-definition"

export const auth = createBetterAuth({
  database: drizzle.mock(),
  config: {
    baseUrl: "http://localhost:3002",
    bootstrapEmail: undefined,
    oidc: {
      clientId: "schema-generation",
      clientSecret: Redacted.make("schema-generation"),
      discoveryUrl:
        "https://accounts.example.com/.well-known/openid-configuration",
      name: "Single sign-on",
    },
    secret: Redacted.make("schema-generation-secret-at-least-32-characters"),
  },
  oidcMetadata: {
    accountIssuer: "https://accounts.example.com",
    authorizationUrl: "https://accounts.example.com/authorize",
    tokenUrl: "https://accounts.example.com/token",
    userInfoUrl: "https://accounts.example.com/userinfo",
  },
})
