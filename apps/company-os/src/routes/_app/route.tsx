import { Outlet, createFileRoute } from "@tanstack/react-router"

import { AppShell } from "@/components/app-shell"

export const Route = createFileRoute("/_app")({ component: CompanyAppLayout })

function CompanyAppLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}
