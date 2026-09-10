import { Effect, Layer } from "effect"

import { bootstrapSystemActor } from "#/runtime/access/server/bootstrap.ts"
import { seedIdentities } from "#/runtime/access/server/seed.ts"
import type { ModelCatalog, ModuleDefinition } from "#/runtime/model/index.ts"
import { PlatformServer } from "#/runtime/platform/server/index.ts"
import { systemInvocation } from "#/runtime/server/invocation-context.ts"
import { CurrentInvocation } from "#/runtime/server/invocation.ts"
import type { ModelContext } from "#/runtime/server/model-context.ts"
import { PageTokens } from "#/runtime/server/page-tokens.ts"
import { makeServicesLayer } from "#/runtime/server/services.ts"
import type { Database } from "#/runtime/server/storage/database.ts"
import {
  layerTest,
  testDatabase,
  type DatabaseInitializer,
} from "#/runtime/testing/database.ts"

type ServerContributions = ReadonlyArray<{
  readonly module: ModuleDefinition
  readonly implementations: Effect.Effect<object, unknown, unknown>
  readonly layer: Layer.Layer<never, unknown, unknown>
}>
type Servers<C extends ServerContributions> = Parameters<
  typeof makeServicesLayer<C>
>[1]
type KernelServers = readonly [typeof PlatformServer]
type Services<C extends ServerContributions> = Layer.Success<
  ReturnType<typeof makeServicesLayer<readonly [...KernelServers, ...C]>>
>

/** The system actor and anonymous attribution record. */
const bootstrapIdentities = bootstrapSystemActor().pipe(
  Effect.andThen(seedIdentities())
)

/** Runs `seed` once per built `services` under the system invocation, alongside the services themselves. */
export function seededLayer<R, E>(
  services: Layer.Layer<R | Database | ModelContext, E>,
  seed: Effect.Effect<
    unknown,
    unknown,
    R | Database | ModelContext | CurrentInvocation
  > = bootstrapIdentities
) {
  return Layer.merge(
    services,
    Layer.effectDiscard(
      seed.pipe(Effect.provideService(CurrentInvocation, systemInvocation))
    ).pipe(Layer.provide(services))
  )
}

/**
 * The kernel's execution foundation over an isolated database: standard services
 * for every object in `model`, the kernel module servers, the given module
 * servers, and a seeded system actor. Every custom action in `model` needs a
 * server. Call at test-file top level; `test` runs each case on a fresh clone
 * under the system invocation.
 */
export function testFoundation<
  M extends ModelCatalog,
  const C extends ServerContributions = readonly [],
>(
  model: M,
  options: {
    readonly servers?: Servers<C>
    readonly initialize?: DatabaseInitializer
    readonly seed?: Effect.Effect<
      unknown,
      unknown,
      Services<C> | CurrentInvocation
    >
  } = {}
) {
  const fixture = testDatabase(model, options.initialize)
  // SAFETY: `servers` was checked against the foundation at the call site and
  // the kernel servers require only the foundation, so the merged tuple has no
  // unmet operation services.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const contributions = [
    PlatformServer,
    ...(options.servers ?? []),
  ] as unknown as Servers<readonly [...KernelServers, ...C]>
  const services = makeServicesLayer(model, contributions, {
    database: fixture.database,
    pageTokens: PageTokens.layerTest,
  })
  const layer = seededLayer(services, options.seed)
  return { ...fixture, services, layer, test: layerTest(layer) }
}
