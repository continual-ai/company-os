import type { ObjectUi } from "@company/ui/model/object-ui"
import { HandshakeIcon } from "lucide-react"

import type { Model } from "#/app.model.ts"
import { DealToolbar } from "#/modules/sales/deal/ui/toolbar.tsx"
import { dealViews } from "#/modules/sales/deal/ui/views.ts"

export const dealUi = {
  navigation: {
    order: 3,
    icon: HandshakeIcon,
    description: "Sales opportunities and next steps.",
  },
  collection: { views: dealViews, toolbarComponent: DealToolbar },
} satisfies ObjectUi<typeof Model.objects.deal>
