import {
  createModelDataClient,
  modelData,
} from "@company/runtime/client/data-client"
import { createRouter as createTanStackRouter } from "@tanstack/react-router"
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query"

import { routeTree } from "#/routeTree.gen.ts"

export function getRouter() {
  const queryClient =
    typeof window === "undefined"
      ? createModelDataClient().queryClient
      : modelData().queryClient
  const router = createTanStackRouter({
    context: { queryClient },
    routeTree,
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
  })
  setupRouterSsrQueryIntegration({ router, queryClient })
  return router
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
