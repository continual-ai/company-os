import { Layer, type Effect } from "effect"

import { BlobStorage } from "#/runtime/assets/server/blob-storage.ts"
import type { ModelCatalog, ModuleDefinition } from "#/runtime/model/index.ts"
import { foundationLayer } from "#/runtime/server/foundation.ts"
import { Operations } from "#/runtime/server/invoke.ts"
import {
  modelImplementationLayer,
  type ModuleRequirements,
} from "#/runtime/server/model/implementation.ts"
import type { PageTokens } from "#/runtime/server/page-tokens.ts"
import type { Database } from "#/runtime/server/storage/database.ts"

export interface ServicesInfrastructure {
  readonly blobStorage?: Layer.Layer<BlobStorage, unknown>
  readonly pageTokens?: Layer.Layer<PageTokens, unknown>
  readonly database: Layer.Layer<Database, unknown>
}

/** Composes explicit module providers with one shared foundation. */
export function makeServicesLayer<
  const C extends ReadonlyArray<{
    readonly module: ModuleDefinition
    readonly implementations: Effect.Effect<object, unknown, unknown>
    readonly layer: Layer.Layer<never, unknown, unknown>
  }>,
>(
  model: ModelCatalog,
  modules: C &
    ([
      Exclude<
        ModuleRequirements<C>,
        | Layer.Success<ReturnType<typeof foundationLayer>>
        | BlobStorage
        | Layer.Success<C[number]["layer"]>
      >,
    ] extends [never]
      ? unknown
      : {
          readonly missingOperationServices: Exclude<
            ModuleRequirements<C>,
            | Layer.Success<ReturnType<typeof foundationLayer>>
            | BlobStorage
            | Layer.Success<C[number]["layer"]>
          >
        }),
  infrastructure: ServicesInfrastructure
) {
  const foundation = foundationLayer(model, infrastructure)
  const blobs =
    infrastructure.blobStorage ??
    BlobStorage.layer.pipe(Layer.provide(infrastructure.database))
  const base = Layer.merge(foundation, blobs)
  // SAFETY: the merged tuple has exactly the union of its declared layer services and requirements.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion, effecttsgo/unsafe-effect-type-assertion
  const moduleLayers = Layer.mergeAll(
    Layer.empty,
    ...modules.map((module) => module.layer)
  ) as Layer.Layer<
    Layer.Success<C[number]["layer"]>,
    Layer.Error<C[number]["layer"]>,
    Layer.Services<C[number]["layer"]>
  >
  const providers = moduleLayers.pipe(Layer.provide(base))
  const services = Layer.merge(base, providers)
  return Layer.mergeAll(
    services,
    Operations.layer.pipe(Layer.provide(services)),
    modelImplementationLayer(model, modules, services)
  )
}
