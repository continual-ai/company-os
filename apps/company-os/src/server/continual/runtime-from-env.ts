import { ConfigProvider, Layer, ManagedRuntime } from "effect"

import { application } from "@/server/composition-root"

import { type WorkerEnv, workerConfigEnv } from "./worker-env"

/**
 * Builds the application runtime from Worker bindings instead of the process
 * environment. The composition is identical to the Node runtime; only the
 * configuration source differs, so hosted behavior never diverges from local
 * behavior by construction.
 */
export function makeWorkerRuntime(env: WorkerEnv) {
  const provider = ConfigProvider.fromEnvRecord(workerConfigEnv(env))
  return ManagedRuntime.make(
    application.layer.pipe(Layer.provide(ConfigProvider.layer(provider)))
  )
}
