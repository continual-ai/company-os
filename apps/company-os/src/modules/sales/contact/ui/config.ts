import type { ObjectUi } from "@company/ui/model/object-ui"
import { ContactRoundIcon } from "lucide-react"

import type { Model } from "#/app.model.ts"
import { contactViews } from "#/modules/sales/contact/ui/views.ts"

export const contactUi = {
  navigation: {
    order: 2,
    icon: ContactRoundIcon,
    description: "People at your customers, prospects, and partners.",
  },
  collection: { views: contactViews },
} satisfies ObjectUi<typeof Model.objects.contact>
