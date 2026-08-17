import { defineApp, defineProject } from "@continual/model"

import { CRM } from "./modules/crm"

export const Acme = defineProject({
  id: "acme",
  name: "Acme",
  modules: [CRM],
  apps: [
    defineApp({
      id: "api",
      name: "API",
      type: "api",
      source: "apps/api",
    }),
    defineApp({
      id: "website",
      name: "Website",
      type: "website",
      source: "apps/website",
    }),
    defineApp({
      id: "portal",
      name: "Portal",
      type: "portal",
      source: "apps/portal",
    }),
    defineApp({
      id: "workspace",
      name: "Workspace",
      type: "workspace",
      source: "apps/workspace",
    }),
  ],
})
