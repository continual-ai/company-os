import { createFileRoute } from "@tanstack/react-router"

import { useAuthenticatedUser } from "@/components/authenticated-user"
import {
  SettingsPage,
  SettingsRow,
  SettingsSection,
} from "@/components/settings-page"
import { pageOptions } from "@/route-metadata"

const page = {
  breadcrumb: "Profile",
  description: "Review the identity associated with this session.",
  title: "Profile settings",
}

export const Route = createFileRoute("/_app/settings/profile")({
  ...pageOptions(page),
  component: ProfileSettings,
})

function ProfileSettings() {
  const user = useAuthenticatedUser()

  return (
    <SettingsPage
      title="Profile"
      description="The canonical Company OS user bound to your login."
    >
      <SettingsSection
        title="Personal information"
        description="Verified identity-provider data is copied when the Company OS User is created."
      >
        <SettingsRow title="Name" description="Shown throughout this app.">
          <span className="text-sm text-foreground">{user.name}</span>
        </SettingsRow>
        <SettingsRow
          title="Email"
          description="Verified by the configured identity provider."
        >
          <span className="text-sm text-foreground">{user.email}</span>
        </SettingsRow>
      </SettingsSection>
    </SettingsPage>
  )
}
