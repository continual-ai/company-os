import type { DefinedProject, ModelDescription } from "@continual/model"

export interface RuntimeClientOptions {
  headers?: () =>
    | Promise<Readonly<Record<string, string>>>
    | Readonly<Record<string, string>>
  origin: string
  rpcPath?: string
}

export class RuntimeClientError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = "RuntimeClientError"
  }
}

export interface RuntimeClient {
  describeModel: () => Promise<ModelDescription>
  health: () => Promise<{ ok: boolean }>
}

/**
 * Creates the universal HTTP bootstrap client. Typed oRPC operations will be
 * added to this surface without changing how Studio or customer apps connect.
 */
export function createRuntimeClient(
  options: RuntimeClientOptions
): RuntimeClient {
  const origin = new URL(options.origin)

  async function request<T>(path: string): Promise<T> {
    const headers = await options.headers?.()
    const response = await fetch(new URL(path, origin), { headers })

    if (!response.ok) {
      throw new RuntimeClientError(
        `Runtime request to ${path} returned ${response.status}.`,
        response.status
      )
    }

    return (await response.json()) as T
  }

  return {
    describeModel: () => request<ModelDescription>("/api/model"),
    health: () => request<{ ok: boolean }>("/health"),
  }
}

/**
 * Retains the concrete Company Model type while the oRPC v2 transport and
 * generated operation surface are implemented in the next runtime slice.
 */
export type RuntimeClientModel<TModel extends DefinedProject> = TModel
