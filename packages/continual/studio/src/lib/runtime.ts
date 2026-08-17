import { createServerFn } from "@tanstack/react-start"

import { createRuntimeClient } from "@continual/client"
import type { ModelDescription } from "@continual/model"

export interface RuntimeOverview {
  connected: boolean
  error?: string
  model?: ModelDescription
  runtimeUrl: string
}

function runtimeUrl() {
  return process.env.CONTINUAL_STUDIO_RUNTIME_URL ?? "http://localhost:4000"
}

function requestHeaders(): Readonly<Record<string, string>> {
  const token = process.env.CONTINUAL_TOKEN
  return token ? { authorization: `Bearer ${token}` } : {}
}

export const getRuntimeOverview = createServerFn({ method: "GET" }).handler(
  async (): Promise<RuntimeOverview> => {
    const origin = runtimeUrl()
    const client = createRuntimeClient({
      headers: requestHeaders,
      origin,
    })

    try {
      const [health, model] = await Promise.all([
        client.health(),
        client.describeModel(),
      ])

      return {
        connected: health.ok === true,
        model,
        runtimeUrl: origin,
      }
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : "Connection failed.",
        runtimeUrl: origin,
      }
    }
  }
)
