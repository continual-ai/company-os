import { createFileRoute } from "@tanstack/react-router"

import { pageOptions } from "@/route-metadata"
import { useAuthenticatedUser } from "@/ui/application/authenticated-user"
import {
  SettingsPage,
  SettingsRow,
  SettingsSection,
} from "@/ui/settings/settings-page"

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
      description="The local User projection resolved from your authenticated identity."
    >
      <SettingsSection
        title="Personal information"
        description="Identity-provider data is projected locally for display, attribution, and authorization."
      >
        <SettingsRow title="Name" description="Shown throughout this app.">
          <span className="text-sm text-foreground">{user.name}</span>
        </SettingsRow>
        <SettingsRow
          title="Email"
          description="Provided by the configured identity boundary."
        >
          <span className="text-sm text-foreground">{user.email}</span>
        </SettingsRow>
      </SettingsSection>
    </SettingsPage>
  )
}
