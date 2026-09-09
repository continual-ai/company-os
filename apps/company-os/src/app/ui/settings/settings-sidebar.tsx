import { Link, useLocation, useMatchRoute } from "@tanstack/react-router"
import {
  BotIcon,
  BlocksIcon,
  PaletteIcon,
  SettingsIcon,
  ShieldCheckIcon,
  UsersRoundIcon,
  UserRoundIcon,
} from "lucide-react"

import { Model } from "#/app.model.ts"
import { presentation } from "#/app/app-presentation.ts"
import {
  SecondarySidebar,
  SecondarySidebarItem,
  SecondarySidebarSection,
} from "#/app/ui/application/secondary-sidebar.tsx"
import { settingsChecks } from "#/app/ui/settings/settings-capabilities.ts"
import { objectHref } from "#/runtime/ui/model/object-routing.ts"
import { useCapabilities } from "#/runtime/ui/model/use-capabilities.ts"

const personalItems = [
  { label: "General", to: "/settings", icon: SettingsIcon },
  { label: "Profile", to: "/settings/profile", icon: UserRoundIcon },
  { label: "Appearance", to: "/settings/appearance", icon: PaletteIcon },
] as const

/** Memberships and assignments are reached from the collection that owns them, so they keep it active. */
const accessItems = [
  { object: Model.objects.user, icon: UserRoundIcon, owns: [] },
  {
    object: Model.objects.role,
    icon: ShieldCheckIcon,
    owns: [Model.objects.roleAssignment],
  },
  {
    object: Model.objects.group,
    icon: UsersRoundIcon,
    owns: [Model.objects.groupMembership],
  },
  { object: Model.objects.serviceAccount, icon: BotIcon, owns: [] },
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
const moduleCheck = { permission: "moduleSetting.catalog" } as const

export function SettingsSidebar() {
  const matchRoute = useMatchRoute()
  const pathname = useLocation({ select: (location) => location.pathname })
  const capabilities = useCapabilities(settingsChecks)
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
      {capabilities.can(moduleCheck) ? (
        <SecondarySidebarSection label="Platform">
          <SecondarySidebarItem
            icon={BlocksIcon}
            isActive={pathname === "/settings/modules"}
            label="Modules"
            link={<Link to="/settings/modules" />}
          />
        </SecondarySidebarSection>
      ) : null}
    </SecondarySidebar>
  )
}
