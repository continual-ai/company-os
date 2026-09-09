import { ConfigProvider, Effect, Layer } from "effect"

import { Model } from "#/app.model.ts"
import {
  makeApplicationLayer,
  type ApplicationInfrastructure,
} from "#/app/server/application-layer.ts"
import { makeApplicationServicesLayer } from "#/app/server/application-services.ts"
import { seedSystem } from "#/app/server/seeds/seed-system.ts"
import { IdentityProvider } from "#/runtime/server/auth/identity-provider.ts"
import { PageTokens } from "#/runtime/server/page-tokens.ts"
import { layerTest, testDatabase } from "#/runtime/testing/database.ts"

/** Requests carry no credentials unless a test supplies its own provider. */
const anonymousIdentityProvider = Layer.succeed(IdentityProvider, {
  identify: () => Effect.succeed(null),
})

/**
 * The application over the current model in an isolated database: every module's
 * services and transports plus the system seed. Call at test-file top level;
 * `test` runs each case on a fresh clone under the system invocation.
 */
export function testApplication({
  configuration = {},
  ...infrastructure
}: Omit<ApplicationInfrastructure, "database" | "pageTokens"> & {
  /** Environment the application layer reads while it is built, such as AUTH_* settings. */
  readonly configuration?: Record<string, string>
} = {}) {
  const fixture = testDatabase(Model)
  const services = makeApplicationServicesLayer({
    database: fixture.database,
    pageTokens: PageTokens.layerTest,
  })
  const application = makeApplicationLayer(
    {
      identityProvider: anonymousIdentityProvider,
      ...infrastructure,
      database: fixture.database,
      pageTokens: PageTokens.layerTest,
    },
    services
  ).pipe(
    Layer.provide(
      ConfigProvider.layer(ConfigProvider.fromEnvRecord(configuration))
    )
  )
  const seeded = Layer.effectDiscard(seedSystem()).pipe(Layer.provide(services))
  const layer = Layer.merge(application, seeded)
  return { ...fixture, services, layer, test: layerTest(layer) }
}
