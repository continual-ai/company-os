import type { PgClient } from "@effect/sql-pg"
import { Layer } from "effect"

import { BlobStorage } from "#/runtime/assets/server/blob-storage.ts"
import type { ModelCatalog } from "#/runtime/model/index.ts"
import { foundationLayer } from "#/runtime/server/foundation.ts"
import type {
  ModuleServer,
  ModuleRequirements,
} from "#/runtime/server/module-server.ts"
import { OperationExecutor } from "#/runtime/server/operation-executor.ts"
import type { PageTokens } from "#/runtime/server/page-tokens.ts"

export interface ServicesInfrastructure {
  readonly blobStorage?: Layer.Layer<BlobStorage, unknown>
  readonly pageTokens?: Layer.Layer<PageTokens, unknown>
  readonly sql: Layer.Layer<PgClient.PgClient, unknown>
}

/** Composes explicit module providers with one shared foundation. */
export function makeServicesLayer<const C extends ReadonlyArray<ModuleServer>>(
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
          readonly missingModuleServices: Exclude<
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
    BlobStorage.layer.pipe(Layer.provide(foundation))
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
  const contributions: C = modules
  return Layer.mergeAll(
    services,
    OperationExecutor.layer<
      C,
      Layer.Error<typeof services>,
      Layer.Services<typeof services>
    >(
      model,
      contributions,
      // The call-site constraint proves all handler dependencies are supplied by these providers.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      services as Layer.Layer<
        Layer.Success<typeof foundation> | ModuleRequirements<C>,
        Layer.Error<typeof services>,
        Layer.Services<typeof services>
      >
    )
  )
}
