import type { ObjectUi } from "@company/runtime/ui/module"
import { ContactRoundIcon } from "lucide-react"

import type { Contact } from "#/model/contact.ts"
import { contactViews } from "#/ui/contact/views.ts"

export const contactUi = {
  navigation: {
    order: 2,
    icon: ContactRoundIcon,
    description: "People at your customers, prospects, and partners.",
  },
  collection: { views: contactViews },
} satisfies ObjectUi<typeof Contact>
