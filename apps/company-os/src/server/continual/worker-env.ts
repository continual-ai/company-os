/**
 * Bindings a hosted deployment supplies to the Worker. The platform binds the
 * pooled database connection string as the DATABASE_URL secret and everything
 * else as plain-text or secret values; dev and preview forward the same names
 * as Worker vars.
 */
export interface WorkerEnv {
  readonly [name: string]: unknown
  readonly DATABASE_URL?: string | undefined
}

/**
 * Projects Worker bindings into the environment record that backs the
 * application's Config reads, so the same composition runs unchanged on Node
 * and on Workers. Connection pools cannot be reused across Worker requests,
 * so the runtime is request-scoped and the pool stays minimal.
 */
export function workerConfigEnv(
  env: WorkerEnv
): Record<string, string | undefined> {
  const record: Record<string, string | undefined> = {
    DATABASE_MAX_CONNECTIONS: "2",
  }
  for (const [name, value] of Object.entries(env)) {
    if (typeof value === "string") record[name] = value
  }
  return record
}
