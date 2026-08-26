import { Model } from "@company/model"
import {
  ActivityIcon,
  BoxesIcon,
  Building2Icon,
  ContactRoundIcon,
  HandshakeIcon,
  HouseIcon,
  UserRoundSearchIcon,
} from "lucide-react"

export const operateNavigation = [
  { label: "Home", to: "/", icon: HouseIcon },
] as const

/** The application-owned operating objects shown in navigation and on the starter home. */
export const objectNavigation = [
  {
    icon: Building2Icon,
    object: Model.objects.company,
    to: "/companies",
  },
  {
    icon: ContactRoundIcon,
    object: Model.objects.contact,
    to: "/contacts",
  },
  { icon: UserRoundSearchIcon, object: Model.objects.lead, to: "/leads" },
  { icon: HandshakeIcon, object: Model.objects.deal, to: "/deals" },
  {
    icon: BoxesIcon,
    object: Model.objects.lineItem,
    to: "/line-items",
  },
  {
    icon: ActivityIcon,
    object: Model.objects.interaction,
    to: "/interactions",
  },
] as const

export const objectNavigationChecks = objectNavigation.map(({ object }) => ({
  permission: `${object.id}.list`,
}))
