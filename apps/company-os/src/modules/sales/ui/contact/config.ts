import { ContactRoundIcon } from "lucide-react"

import type { Contact } from "#/modules/sales/model/contact.ts"
import { contactViews } from "#/modules/sales/ui/contact/views.ts"
import type { ObjectUi } from "#/runtime/ui/module.ts"

export const contactUi = {
  navigation: {
    order: 2,
    icon: ContactRoundIcon,
    description: "People at your customers, prospects, and partners.",
  },
  collection: { views: contactViews },
} satisfies ObjectUi<typeof Contact>
