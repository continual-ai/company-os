import { createFileRoute } from "@tanstack/react-router"
import { Model } from "company-os/model"

import { pageOptions } from "@/route-metadata"

export const Route = createFileRoute("/_app/_sales/contacts")({
  ...pageOptions({
    breadcrumb: "Contacts",
    description: Model.objects.contact.description ?? "Browse contact records.",
    title: "Contacts",
  }),
})
