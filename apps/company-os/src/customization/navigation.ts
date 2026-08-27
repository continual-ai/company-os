import { Model } from "@company/model"
import {
  ActivityIcon,
  Building2Icon,
  ContactRoundIcon,
  HandshakeIcon,
  HouseIcon,
  UserRoundSearchIcon,
} from "lucide-react"

import { capabilityPermission } from "@/capabilities"

export const operateNavigation = [
  { label: "Home", to: "/", icon: HouseIcon },
] as const

/** Application-owned sales destinations; the model supplies meaning, not route policy. */
export const salesNavigation = [
  {
    description: "Qualify new interest and convert it into customer records.",
    icon: UserRoundSearchIcon,
    label: "Leads",
    object: Model.objects.lead,
    to: "/leads",
  },
  {
    description:
      "Keep the organizations behind opportunities and customers connected.",
    icon: Building2Icon,
    label: "Companies",
    object: Model.objects.company,
    to: "/companies",
  },
  {
    description: "Coordinate the people involved in each relationship.",
    icon: ContactRoundIcon,
    label: "Contacts",
    object: Model.objects.contact,
    to: "/contacts",
  },
  {
    description: "Advance active opportunities toward a clear outcome.",
    icon: HandshakeIcon,
    label: "Deals",
    object: Model.objects.deal,
    to: "/deals",
  },
  {
    description:
      "Review the calls, emails, meetings, and notes around the work.",
    icon: ActivityIcon,
    label: "Activity",
    object: Model.objects.interaction,
    to: "/interactions",
  },
] as const

export const salesNavigationChecks = salesNavigation.map(({ object }) => ({
  permission: capabilityPermission(`${object.id}.list`),
}))
