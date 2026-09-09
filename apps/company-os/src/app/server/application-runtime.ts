import { getRequest } from "@tanstack/react-start/server"
import { ConfigProvider, type Effect, Layer, ManagedRuntime } from "effect"

import { applicationLayer } from "#/app/server/application-layer.ts"
import { developmentDefaults } from "#/app/server/config.ts"

/**
 * Builds the server runtime over the process environment. Development also
 * falls back to the checked-in defaults so a fresh checkout runs without files.
 */
function makeApplicationRuntime() {
  const configuration = import.meta.env.DEV
    ? ConfigProvider.layerAdd(developmentDefaults)
    : Layer.empty
  return ManagedRuntime.make(
    applicationLayer.pipe(Layer.provide(configuration))
  )
}

type ApplicationRuntime = ReturnType<typeof makeApplicationRuntime>
type ApplicationServices =
  ManagedRuntime.ManagedRuntime.Services<ApplicationRuntime>

let nodeRuntime: ApplicationRuntime | undefined

declare global {
  var appDevelopmentRuntime: ApplicationRuntime | undefined
}

// SSR module replacement does not run browser HMR disposal hooks. A new revision
// releases the old development runtime before constructing services with new identities.
if (import.meta.env.DEV) {
  void globalThis.appDevelopmentRuntime?.dispose()
  globalThis.appDevelopmentRuntime = undefined
}

const workerRuntimes = new WeakMap<Request, ApplicationRuntime>()

// Worker requests cannot rely on response hooks for cleanup, so disposal is
// tied to the request object's collection; the pool's idle timeout bounds any
// window in which a collected request's connections linger.
const disposeOnCollect = new FinalizationRegistry<ApplicationRuntime>(
  (runtime) => {
    void runtime.dispose()
  }
)

function runningInWorkerd(): boolean {
  return globalThis.navigator?.userAgent === "Cloudflare-Workers"
}

function resolveRuntime(): ApplicationRuntime {
  if (!runningInWorkerd()) {
    // Long-lived process: scoped infrastructure is built once and shared.
    nodeRuntime ??= makeApplicationRuntime()
    if (import.meta.env.DEV) globalThis.appDevelopmentRuntime = nodeRuntime
    return nodeRuntime
  }
  // workerd forbids using I/O such as pooled sockets across requests, so each
  // request gets its own runtime; repeated runs within one request share it.
  const request = getRequest()
  const existing = workerRuntimes.get(request)
  if (existing !== undefined) return existing
  const runtime = makeApplicationRuntime()
  workerRuntimes.set(request, runtime)
  disposeOnCollect.register(request, runtime)
  return runtime
}

/** Runs server effects on the runtime appropriate to the hosting environment. */
export const applicationRuntime = {
  runPromise<A, E>(
    effect: Effect.Effect<A, E, ApplicationServices>,
    options?: Effect.RunOptions
  ): Promise<A> {
    return resolveRuntime().runPromise(effect, options)
  },
} as const
