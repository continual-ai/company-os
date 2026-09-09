import { Link, useLocation, useMatchRoute } from "@tanstack/react-router"
import {
  BotIcon,
  PaletteIcon,
  SettingsIcon,
  ShieldCheckIcon,
  UsersRoundIcon,
  UserRoundIcon,
} from "lucide-react"

import { EnabledModel } from "#/app.model.ts"
import { presentation } from "#/app/app-presentation.ts"
import {
  SecondarySidebar,
  SecondarySidebarItem,
  SecondarySidebarSection,
} from "#/app/ui/application/secondary-sidebar.tsx"
import { objectHref } from "#/runtime/ui/model/object-routing.ts"
import { useCapabilities } from "#/runtime/ui/model/use-capabilities.ts"

const personalItems = [
  { label: "General", to: "/settings", icon: SettingsIcon },
  { label: "Profile", to: "/settings/profile", icon: UserRoundIcon },
  { label: "Appearance", to: "/settings/appearance", icon: PaletteIcon },
] as const

/** Memberships and assignments are reached from the collection that owns them, so they keep it active. */
const accessItems = [
  { object: EnabledModel.objects.user, icon: UserRoundIcon, owns: [] },
  {
    object: EnabledModel.objects.role,
    icon: ShieldCheckIcon,
    owns: [EnabledModel.objects.roleAssignment],
  },
  {
    object: EnabledModel.objects.group,
    icon: UsersRoundIcon,
    owns: [EnabledModel.objects.groupMembership],
  },
  { object: EnabledModel.objects.serviceAccount, icon: BotIcon, owns: [] },
].map(({ object, icon, owns }) => ({
  label: object.pluralName,
  icon,
  to: objectHref(presentation, object),
  paths: [object, ...owns].map((owned) => objectHref(presentation, owned)),
  check: {
    permission: presentation.permissions.capabilityPermission(
      `${object.id}.list`
    ),
  },
}))
const accessChecks = accessItems.map(({ check }) => check)

export function SettingsSidebar() {
  const matchRoute = useMatchRoute()
  const pathname = useLocation({ select: (location) => location.pathname })
  const capabilities = useCapabilities(accessChecks)
  const access = accessItems.filter((item) => capabilities.can(item.check))

  return (
    <SecondarySidebar>
      <SecondarySidebarSection label="Personal">
        {personalItems.map((item) => (
          <SecondarySidebarItem
            key={item.to}
            icon={item.icon}
            isActive={Boolean(matchRoute({ to: item.to }))}
            label={item.label}
            link={<Link to={item.to} />}
          />
        ))}
      </SecondarySidebarSection>
      {access.length === 0 ? null : (
        <SecondarySidebarSection label="Access">
          {access.map((item) => (
            <SecondarySidebarItem
              key={item.to}
              icon={item.icon}
              isActive={item.paths.some(
                (path) => pathname === path || pathname.startsWith(`${path}/`)
              )}
              label={item.label}
              link={<Link to={item.to} />}
            />
          ))}
        </SecondarySidebarSection>
      )}
    </SecondarySidebar>
  )
}
