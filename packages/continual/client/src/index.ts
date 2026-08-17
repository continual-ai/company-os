import type { DefinedProject, ModelDescription } from "@continual/model"
import { z } from "zod"

const fieldOptions = {
  description: z.string().optional(),
  required: z.boolean().optional(),
}

const fieldDefinitionSchema = z.discriminatedUnion("kind", [
  z.object({
    ...fieldOptions,
    kind: z.enum(["date", "email", "phone", "text", "url"]),
  }),
  z.object({
    ...fieldOptions,
    kind: z.literal("select"),
    options: z.array(
      z.object({ label: z.string().optional(), value: z.string() })
    ),
  }),
  z.object({ ...fieldOptions, kind: z.literal("link"), objectId: z.string() }),
])

const modelDescriptionSchema = z.object({
  apps: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      source: z.string(),
      type: z.string(),
    })
  ),
  modules: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      objects: z.array(
        z.object({
          description: z.string().optional(),
          display: z.object({
            status: z.string().optional(),
            subtitle: z.string().optional(),
            title: z.string(),
          }),
          fields: z.record(z.string(), fieldDefinitionSchema),
          id: z.string(),
          name: z.string(),
          pluralName: z.string(),
        })
      ),
    })
  ),
  project: z.object({ id: z.string(), name: z.string() }),
  version: z.literal("0.1"),
}) satisfies z.ZodType<ModelDescription>

const healthSchema = z.object({ ok: z.boolean() })

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

  async function request<T>(path: string, schema: z.ZodType<T>): Promise<T> {
    const headers = await options.headers?.()
    const response = await fetch(new URL(path, origin), { headers })

    if (!response.ok) {
      throw new RuntimeClientError(
        `Runtime request to ${path} returned ${response.status}.`,
        response.status
      )
    }

    return schema.parse(await response.json())
  }

  return {
    describeModel: () => request("/api/model", modelDescriptionSchema),
    health: () => request("/health", healthSchema),
  }
}

/**
 * Retains the concrete Company Model type while the oRPC v2 transport and
 * generated operation surface are implemented in the next runtime slice.
 */
export type RuntimeClientModel<TModel extends DefinedProject> = TModel
