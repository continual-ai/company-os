import type { Model } from "company-os/model"
import { ContactRoundIcon } from "lucide-react"

import type { ObjectUi } from "@/ui/model/module-ui"

import { contactViews } from "./views"

export const contactUi = {
  navigation: {
    order: 2,
    icon: ContactRoundIcon,
    description: "People at your customers, prospects, and partners.",
  },
  collection: { views: contactViews },
} satisfies ObjectUi<typeof Model.objects.contact>
