import type { Model } from "company-os/model"

import type { ObjectUi } from "@/ui/model/module-ui"

import { RoleToolbar } from "./toolbar"
export const roleUi = {
  navigation: { hidden: true },
  collection: { toolbarComponent: RoleToolbar },
} satisfies ObjectUi<typeof Model.objects.role>
