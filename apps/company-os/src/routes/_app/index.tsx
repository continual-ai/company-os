import { createFileRoute } from "@tanstack/react-router"

import { CompanyHome } from "@/company/home"
import { pageOptions } from "@/route-metadata"

const page = {
  breadcrumb: "Home",
  description:
    "Run work from shared business context used by people, applications, integrations, and agents.",
  title: "Home",
}

export const Route = createFileRoute("/_app/")({
  ...pageOptions(page),
  component: CompanyHome,
})
