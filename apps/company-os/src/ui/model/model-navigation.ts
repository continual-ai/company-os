import { Model } from "company-os/model"
import { BoxesIcon } from "lucide-react"

import { modelUi } from "@/app-ui"
import { capabilityPermission } from "@/capabilities"

import { objectHref } from "./object-routing"

/** Sidebar and home share the same module-owned destinations. */
export const modelNavigation = Object.values(Model.modules).map((module) => ({
  id: module.id,
  name: module.name,
  items: module.objects
    .flatMap((definition) => {
      const object = Object.values(Model.objects).find(
        (candidate) => candidate.id === definition.id
      )!
      const navigation = modelUi[object.id]?.navigation
      if (navigation?.hidden) return []
      return [
        {
          object,
          label: object.pluralName,
          description: navigation?.description ?? object.description,
          icon: navigation?.icon ?? BoxesIcon,
          order: navigation?.order ?? 100,
          to: objectHref(object),
          check: { permission: capabilityPermission(`${object.id}.list`) },
        },
      ]
    })
    .sort((a, b) => a.order - b.order),
}))
export const modelNavigationChecks = modelNavigation.flatMap((module) =>
  module.items.map((item) => item.check)
)
