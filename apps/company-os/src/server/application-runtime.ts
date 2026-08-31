import { getRequest } from "@tanstack/react-start/server"
import { type Effect, ManagedRuntime } from "effect"

import { application } from "./composition-root"
import { currentWorkerEnv } from "./continual/request-env"
import { makeWorkerRuntime } from "./continual/runtime-from-env"

function makeNodeRuntime() {
  return ManagedRuntime.make(application.layer)
}

type ApplicationRuntime = ReturnType<typeof makeNodeRuntime>
type ApplicationServices =
  ManagedRuntime.ManagedRuntime.Services<ApplicationRuntime>

let nodeRuntime: ApplicationRuntime | undefined

const workerRuntimes = new WeakMap<Request, ApplicationRuntime>()

// Worker requests cannot rely on response hooks for cleanup, so disposal is
// tied to the request object's collection; the pool's idle timeout bounds any
// window in which a collected request's connections linger.
const disposeOnCollect = new FinalizationRegistry<ApplicationRuntime>(
  (runtime) => {
    void runtime.dispose()
  }
)

async function resolveRuntime(): Promise<ApplicationRuntime> {
  const env = await currentWorkerEnv()
  if (env === undefined) {
    // Long-lived process: scoped infrastructure is built once and shared.
    nodeRuntime ??= makeNodeRuntime()
    return nodeRuntime
  }
  // workerd forbids using I/O such as pooled sockets across requests, so each
  // request gets its own runtime; repeated runs within one request share it.
  const request = getRequest()
  const existing = workerRuntimes.get(request)
  if (existing !== undefined) return existing
  const runtime = makeWorkerRuntime(env)
  workerRuntimes.set(request, runtime)
  disposeOnCollect.register(request, runtime)
  return runtime
}

/** Runs server effects on the runtime appropriate to the hosting environment. */
export const applicationRuntime = {
  runPromise<A, E>(
    effect: Effect.Effect<A, E, ApplicationServices>
  ): Promise<A> {
    return resolveRuntime().then((runtime) => runtime.runPromise(effect))
  },
} as const
