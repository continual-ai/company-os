import { Outlet, createFileRoute, redirect } from "@tanstack/react-router"

import { modelUi } from "@/app-ui"
import { getCurrentUser } from "@/current-user.functions"
import { modelData } from "@/data-client"
import { AppShell } from "@/ui/application/app-shell"
import { useModelEvents } from "@/ui/application/use-model-events"
import { ModelUiProvider } from "@/ui/model/module-ui"

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
    return { authenticatedUser: currentUser.user }
  },
  component: CompanyAppLayout,
})

function CompanyAppLayout() {
  const { authenticatedUser } = Route.useRouteContext()
  useModelEvents(authenticatedUser.id)
  return (
    <ModelUiProvider value={modelUi}>
      <AppShell key={authenticatedUser.id} user={authenticatedUser}>
        <Outlet />
      </AppShell>
    </ModelUiProvider>
  )
}
