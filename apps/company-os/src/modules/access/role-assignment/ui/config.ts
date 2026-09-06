import type { Model } from "company-os/model"

import type { ObjectUi } from "@/ui/model/module-ui"

export const roleAssignmentUi = {
  navigation: { hidden: true },
} satisfies ObjectUi<typeof Model.objects.roleAssignment>
