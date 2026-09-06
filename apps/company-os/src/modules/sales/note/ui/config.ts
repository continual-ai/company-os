import type { Model } from "company-os/model"
import { NotebookPenIcon } from "lucide-react"

import type { ObjectUi } from "@/ui/model/module-ui"

import { noteViews } from "./views"

export const noteUi = {
  navigation: {
    path: "/notes",
    order: 4,
    icon: NotebookPenIcon,
    description: "Keep durable context attached to the records it concerns.",
  },
  collection: { views: noteViews },
} satisfies ObjectUi<typeof Model.objects.note>
