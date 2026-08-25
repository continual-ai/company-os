import { Button } from "@company/ui/components/button"
import { Link, createFileRoute } from "@tanstack/react-router"

import {
  SettingsPage,
  SettingsRow,
  SettingsSection,
} from "@/components/settings-page"
import { pageOptions } from "@/route-metadata"
import { useSignOut } from "@/sign-out"

const page = {
  breadcrumb: "General",
  description: "Review the authenticated account and session settings.",
  title: "General settings",
}

export const Route = createFileRoute("/_app/settings/")({
  ...pageOptions(page),
  component: GeneralSettings,
})

function GeneralSettings() {
  const { error, pending, signOut } = useSignOut()

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
          title="Session"
          description="Your browser is authenticated by the configured identity provider."
        >
          <span className="text-xs font-medium text-muted-foreground">
            Active
          </span>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        title="Access"
        description="Authentication is managed by the configured identity provider."
      >
        <SettingsRow title="Log out" description="End this browser session.">
          <div className="space-y-2 text-right">
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => void signOut()}
            >
              {pending ? "Logging out…" : "Log out"}
            </Button>
            {error ? (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
            ) : null}
          </div>
        </SettingsRow>
      </SettingsSection>
    </SettingsPage>
  )
}
