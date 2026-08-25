import { drizzle } from "drizzle-orm/node-postgres"
import { Config, Context, Data, Effect, Layer, Redacted } from "effect"
import { Pool } from "pg"

import { betterAuthSchema } from "@/server/database/schema.server"

import { AuthSettings } from "./auth-config.server"
import { createBetterAuth } from "./better-auth-definition.server"

class AuthProtocolFailure extends Data.TaggedError("AuthProtocolFailure")<{
  readonly cause: unknown
  readonly operation: "handle" | "session"
}> {}

/** Provider-neutral authenticated user data read from a valid browser session. */
export interface AuthUser {
  readonly authUserId: string
  readonly email: string
  readonly emailVerified: boolean
  readonly name: string
}

const make = Effect.gen(function* () {
  const config = yield* AuthSettings
  const databaseUrl = yield* Config.redacted("DATABASE_URL")
  const pool = yield* Effect.acquireRelease(
    Effect.sync(
      () =>
        new Pool({
          allowExitOnIdle: true,
          application_name: "company-os-auth",
          connectionString: Redacted.value(databaseUrl),
          connectionTimeoutMillis: 5_000,
          max: 5,
        })
    ),
    (acquiredPool) => Effect.promise(() => acquiredPool.end())
  )
  const auth = createBetterAuth({
    config,
    database: drizzle({ client: pool }),
    schema: betterAuthSchema,
  })

  return {
    handle: Effect.fn("@company/AuthProtocol.handle")(function* (
      request: Request
    ) {
      return yield* Effect.tryPromise({
        try: () => auth.handler(request),
        catch: (cause) =>
          new AuthProtocolFailure({ cause, operation: "handle" }),
      })
    }),
    session: Effect.fn("@company/AuthProtocol.session")(function* (
      headers: Headers
    ) {
      const session = yield* Effect.tryPromise({
        try: () => auth.api.getSession({ headers }),
        catch: (cause) =>
          new AuthProtocolFailure({ cause, operation: "session" }),
      })
      if (session === null) return null
      return {
        authUserId: session.user.id,
        email: session.user.email,
        emailVerified: session.user.emailVerified,
        name: session.user.name,
      } satisfies AuthUser
    }),
  }
})

/** Owns the private OIDC/session engine and its database-pool lifecycle. */
export class AuthProtocol extends Context.Service<AuthProtocol>()(
  "@company/AuthProtocol",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
