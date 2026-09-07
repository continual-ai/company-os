import type { Model } from "company-os/model"
import { HandshakeIcon } from "lucide-react"

import type { ObjectUi } from "@/ui/model/module-ui"

import { DealToolbar } from "./toolbar"
import { dealViews } from "./views"

export const dealUi = {
  navigation: {
    order: 3,
    icon: HandshakeIcon,
    description: "Sales opportunities and next steps.",
  },
  collection: { views: dealViews, toolbarComponent: DealToolbar },
} satisfies ObjectUi<typeof Model.objects.deal>
