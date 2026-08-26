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
  description: "Review the identity and interface settings.",
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
      description="Manage the settings that apply to this interface."
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
          title="Identity provider"
          description="Authentication, sessions, and credentials are managed by the deployment boundary."
        >
          <span className="text-xs font-medium text-muted-foreground">
            Externally managed
          </span>
        </SettingsRow>
      </SettingsSection>
    </SettingsPage>
  )
}
