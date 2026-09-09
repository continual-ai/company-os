import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem"
import { ConfigProvider, Effect, Layer } from "effect"

import { localConfigProvider } from "#/app/server/config.ts"

/** Repository tools read the environment, `.env.local` files, and, when asked, the development defaults. */
export function localConfigLayer(options: { readonly development: boolean }) {
  return ConfigProvider.layer(
    localConfigProvider(options).pipe(Effect.provide(NodeFileSystem.layer))
  )
}

/** A layer that needs configuration while it is built, alongside the configuration itself. */
export function withLocalConfig<ROut, E, RIn>(
  layer: Layer.Layer<ROut, E, RIn>,
  options: { readonly development: boolean }
) {
  const config = localConfigLayer(options)
  return Layer.merge(config, layer.pipe(Layer.provide(config)))
}
