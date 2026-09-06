import type { Model } from "company-os/model"
import { CircleDotIcon } from "lucide-react"

import type { ObjectUi } from "@/ui/model/module-ui"

import { IssueDescription } from "./description-field"

export const issueUi = {
  navigation: {
    icon: CircleDotIcon,
    description: "Track planned work, assign owners, and resolve issues.",
  },
  fieldEditors: { description: IssueDescription },
} satisfies ObjectUi<typeof Model.objects.issue>
