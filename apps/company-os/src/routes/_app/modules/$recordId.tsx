import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_app/modules/$recordId")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/settings/modules/$recordId",
      params,
      search: true,
      replace: true,
    })
  },
})
