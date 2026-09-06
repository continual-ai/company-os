import type { Model } from "company-os/model"
import { ContactRoundIcon } from "lucide-react"

import type { ObjectUi } from "@/ui/model/module-ui"

import { contactViews } from "./views"

export const contactUi = {
  navigation: {
    path: "/contacts",
    order: 2,
    icon: ContactRoundIcon,
    description: "Coordinate the people involved in each relationship.",
  },
  collection: { views: contactViews },
} satisfies ObjectUi<typeof Model.objects.contact>
