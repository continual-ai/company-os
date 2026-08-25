import { Outlet, createFileRoute, redirect } from "@tanstack/react-router"

import { AppShell } from "@/components/app-shell"
import { getCurrentSession } from "@/current-session"

export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    const session = await getCurrentSession()
    if (session.status === "unauthenticated") {
      throw redirect({ to: "/sign-in" })
    }
    if (session.status === "forbidden") {
      throw redirect({ to: "/access-denied" })
    }
    return { authenticatedUser: session.user }
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
