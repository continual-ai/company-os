import { createFileRoute } from "@tanstack/react-router"

import { pageOptions } from "#/route-metadata.ts"
import { useAuthenticatedUser } from "#/ui/application/authenticated-user.tsx"
import {
  SettingsPage,
  SettingsRow,
  SettingsSection,
} from "#/ui/settings/settings-page.tsx"

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
      description="Your profile information for this workspace."
    >
      <SettingsSection
        title="Personal information"
        description="Managed by your sign-in provider."
      >
        <SettingsRow title="Name" description="Shown throughout this app.">
          <span className="text-sm text-foreground">{user.name}</span>
        </SettingsRow>
        <SettingsRow title="Email" description="Your sign-in email address.">
          <span className="text-sm text-foreground">{user.email}</span>
        </SettingsRow>
      </SettingsSection>
    </SettingsPage>
  )
}
