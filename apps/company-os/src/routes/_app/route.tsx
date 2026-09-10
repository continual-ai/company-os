import { Outlet, createFileRoute, redirect } from "@tanstack/react-router"
import { useEffect, useState } from "react"

import { client } from "#/app/app-client.ts"
import { getCurrentUser } from "#/app/current-user.functions.ts"
import { ActiveModelProvider } from "#/app/ui/application/active-model-provider.tsx"
import { moduleCatalogQuery } from "#/app/ui/application/active-presentation.ts"
import { AppShell } from "#/app/ui/application/app-shell.tsx"
import { useModelEvents } from "#/app/ui/application/use-model-events.ts"
import { runClientEffect } from "#/runtime/client/create-client.ts"
import { modelData } from "#/runtime/client/data-client.ts"

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ location }) => {
    const currentUser = await getCurrentUser()
    if (currentUser.status === "unauthenticated") {
      throw redirect({
        to: "/sign-in",
        search: { returnTo: location.href },
      })
    }
    if (typeof window !== "undefined")
      modelData().setIdentity(currentUser.user.id)
    // Capture the feed head before child loaders read their snapshots.
    const eventCursor =
      typeof window === "undefined"
        ? (await runClientEffect(client.events.list({ cursor: "now" })))
            .nextCursor
        : undefined
    return { authenticatedUser: currentUser.user, eventCursor }
  },
  loader: async ({ context }) => {
    await context.queryClient.prefetchQuery(moduleCatalogQuery)
  },
  component: CompanyAppLayout,
})

function CompanyAppLayout() {
  const { authenticatedUser, eventCursor } = Route.useRouteContext()
  // Hydration reuses server route context without running the browser beforeLoad.
  useEffect(() => {
    modelData().setIdentity(authenticatedUser.id)
  }, [authenticatedUser.id])
  const [initialFeed] = useState(() => ({
    identity: authenticatedUser.id,
    cursor: eventCursor,
  }))
  useModelEvents(
    authenticatedUser.id,
    initialFeed.identity === authenticatedUser.id
      ? initialFeed.cursor
      : undefined
  )
  return (
    <ActiveModelProvider>
      <AppShell key={authenticatedUser.id} user={authenticatedUser}>
        <Outlet />
      </AppShell>
    </ActiveModelProvider>
  )
}
