import { Button } from "@company/ui/components/button"
import { Link, createFileRoute } from "@tanstack/react-router"

import {
  SettingsPage,
  SettingsRow,
  SettingsSection,
} from "@/components/settings-page"
import { pageOptions } from "@/route-metadata"

const page = {
  breadcrumb: "General",
  description: "Review the local account and session settings.",
  title: "General settings",
}

export const Route = createFileRoute("/_app/settings/")({
  ...pageOptions(page),
  component: GeneralSettings,
})

function GeneralSettings() {
  return (
    <SettingsPage
      title="General"
      description="Manage the settings that apply to this local interface."
    >
      <SettingsSection title="Account">
        <SettingsRow
          title="Profile"
          description="The name and contact information shown in this app."
        >
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link to="/settings/profile" />}
          >
            Manage
          </Button>
        </SettingsRow>
        <SettingsRow
          title="Session"
          description="This scaffold currently uses a local development identity."
        >
          <span className="text-xs font-medium text-muted-foreground">
            Signed in locally
          </span>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        title="Access"
        description="Authentication and account lifecycle controls belong here when a real identity provider is connected."
      >
        <SettingsRow
          title="Log out"
          description="Unavailable because the local development identity does not create a login session."
        >
          <Button variant="outline" size="sm" disabled>
            Log out
          </Button>
        </SettingsRow>
      </SettingsSection>
    </SettingsPage>
  )
}
