import { Outlet, createFileRoute, redirect } from "@tanstack/react-router"

import { AppShell } from "@/components/app-shell"
import { getCurrentUser } from "@/current-user.functions"

export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    const currentUser = await getCurrentUser()
    if (currentUser.status === "unauthenticated") {
      throw redirect({ to: "/access-denied" })
    }
    if (currentUser.status === "forbidden") {
      throw redirect({ to: "/access-denied" })
    }
    return { authenticatedUser: currentUser.user }
  },
  component: CompanyAppLayout,
})

function CompanyAppLayout() {
  const { authenticatedUser } = Route.useRouteContext()
  return (
    <AppShell user={authenticatedUser}>
      <Outlet />
    </AppShell>
  )
}
