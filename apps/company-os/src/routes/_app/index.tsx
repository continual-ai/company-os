import { createFileRoute } from "@tanstack/react-router"

import { Home } from "@/customization/home"
import { pageOptions } from "@/route-metadata"

const page = {
  breadcrumb: "Home",
  description:
    "Qualify leads, coordinate customer context, and advance active sales opportunities.",
  title: "Home",
}

export const Route = createFileRoute("/_app/")({
  ...pageOptions(page),
  component: Home,
})
