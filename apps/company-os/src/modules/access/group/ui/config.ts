import type { Model } from "company-os/model"

import type { ObjectUi } from "@/ui/model/module-ui"

import { GroupToolbar } from "./toolbar"
export const groupUi = {
  navigation: { hidden: true },
  collection: { toolbarComponent: GroupToolbar },
} satisfies ObjectUi<typeof Model.objects.group>
