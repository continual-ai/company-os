import type { WorkerEnv } from "./worker-env"

// The specifier resolves only inside workerd; bundlers and Node must treat it
// as an ordinary runtime import that may reject.
const WORKER_ENTRYPOINT = "cloudflare:workers"

let workerEnv: WorkerEnv | undefined
let resolution: Promise<void> | undefined

function runningInWorkerd(): boolean {
  const navigator = (
    globalThis as { navigator?: { userAgent?: string } | undefined }
  ).navigator
  return navigator?.userAgent === "Cloudflare-Workers"
}

function asWorkerEnv(value: unknown): WorkerEnv | undefined {
  if (typeof value !== "object" || value === null) return undefined
  // The Worker environment is host-constructed; this boundary narrows it once.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return value as WorkerEnv
}

/** Resolves the Worker bindings when running inside workerd, undefined on Node. */
export function currentWorkerEnv(): Promise<WorkerEnv | undefined> {
  if (!runningInWorkerd()) return Promise.resolve(undefined)
  resolution ??= import(/* @vite-ignore */ WORKER_ENTRYPOINT).then(
    (module: { env: unknown }) => {
      workerEnv = asWorkerEnv(module.env)
    },
    () => undefined
  )
  return resolution.then(() => workerEnv)
}
