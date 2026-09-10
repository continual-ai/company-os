import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_app/modules/")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/modules", replace: true })
  },
})
