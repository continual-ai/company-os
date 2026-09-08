import { Outlet, createFileRoute, redirect } from "@tanstack/react-router"
import { useEffect, useState } from "react"

import { listEvents } from "#/app-client.ts"
import { modelUi } from "#/app.ui.ts"
import { getCurrentUser } from "#/current-user.functions.ts"
import { modelData } from "#/data-client.ts"
import { runClientEffect } from "#/model-query-client.ts"
import { AppShell } from "#/ui/application/app-shell.tsx"
import { allowedCapabilitiesQuery } from "#/ui/application/load-capabilities.ts"
import { useModelEvents } from "#/ui/application/use-model-events.ts"
import { modelNavigationChecks } from "#/ui/model/model-navigation.ts"
import { ModelUiProvider } from "#/ui/model/module-ui.tsx"

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
        ? (await runClientEffect(listEvents({ cursor: "now" }))).nextCursor
        : undefined
    return { authenticatedUser: currentUser.user, eventCursor }
  },
  loader: async ({ context }) => {
    // Advisory navigation checks must not fail the route when their observer unmounts or a check fails.
    await context.queryClient.prefetchQuery(
      allowedCapabilitiesQuery(modelNavigationChecks)
    )
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
    <ModelUiProvider value={modelUi}>
      <AppShell key={authenticatedUser.id} user={authenticatedUser}>
        <Outlet />
      </AppShell>
    </ModelUiProvider>
  )
}
