import { Model } from "@company/model"
import { createFileRoute } from "@tanstack/react-router"

import { pageOptions } from "@/route-metadata"

export const Route = createFileRoute("/_app/_sales/notes")({
  ...pageOptions({
    breadcrumb: "Notes",
    description: Model.objects.note.description ?? "Browse notes.",
    title: Model.objects.note.pluralName,
  }),
})
