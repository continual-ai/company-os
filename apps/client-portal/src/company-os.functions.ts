import { runtimeIdentityHeaders } from "@continual/sdk/app"
import { createServerFn } from "@tanstack/react-start"
import { getRequest } from "@tanstack/react-start/server"
import { createClient } from "company-os/client"
import { Model } from "company-os/model"

/** COMPANY_OS_URL names the central app; development defaults to its dev port. */
function companyOsUrl(): string {
  // This app is not an Effect application, so its one deployment value is read directly.
  // oxlint-disable-next-line effecttsgo/process-env
  return process.env.COMPANY_OS_URL ?? "http://localhost:3002"
}

/**
 * The central application's typed client for this request. Identity headers are
 * forwarded from the hosting platform; this app never mints identity itself.
 */
function companyOs(request: Request) {
  return createClient(Model, {
    baseUrl: companyOsUrl(),
    headers: runtimeIdentityHeaders(request),
  })
}

export const listPeople = createServerFn({ method: "GET" }).handler(
  async () => {
    const client = companyOs(getRequest())
    try {
      const page = await client.user.list({ pageSize: 5 })
      return {
        people: page.items.map(({ id, name }) => ({ id, name })),
        total: page.totalSize,
        error: null,
      }
    } catch (error) {
      return {
        people: [],
        total: 0,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }
)
