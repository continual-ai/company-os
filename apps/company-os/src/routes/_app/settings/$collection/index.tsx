import { createFileRoute, notFound, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_app/settings/$collection/")({
  beforeLoad: ({ params }) => {
    const objectType =
      params.collection === "users"
        ? "user"
        : params.collection === "service-accounts"
          ? "serviceAccount"
          : undefined
    if (!objectType) throw notFound()
    throw redirect({
      to: "/objects/$objectType",
      params: { objectType },
      replace: true,
    })
  },
})
