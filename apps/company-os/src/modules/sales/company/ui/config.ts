import type { Model } from "company-os/model"
import { Building2Icon } from "lucide-react"

import type { ObjectUi } from "@/ui/model/module-ui"

import { companyViews } from "./views"

export const companyUi = {
  navigation: {
    path: "/companies",
    order: 1,
    icon: Building2Icon,
    description:
      "Keep organizations and their customer relationships connected.",
  },
  collection: { views: companyViews },
} satisfies ObjectUi<typeof Model.objects.company>
