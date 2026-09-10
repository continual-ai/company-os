import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_app/settings/modules")({
  beforeLoad: () => {
    throw redirect({ to: "/modules", replace: true })
  },
})
