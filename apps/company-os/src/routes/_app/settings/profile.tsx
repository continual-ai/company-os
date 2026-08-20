import { createFileRoute } from "@tanstack/react-router"
import { useEffect, useRef } from "react"

import { useCompanyForm } from "@/components/company-form"
import { useLocalProfile } from "@/components/local-profile"
import { SettingsPage, SettingsSection } from "@/components/settings-page"
import { pageOptions } from "@/route-metadata"

const page = {
  breadcrumb: "Profile",
  description: "Edit the local profile shown throughout Acme Company OS.",
  title: "Profile settings",
}

export const Route = createFileRoute("/_app/settings/profile")({
  ...pageOptions(page),
  component: ProfileSettings,
})

function ProfileSettings() {
  const { hydrated, profile, updateProfile } = useLocalProfile()
  const initialized = useRef(false)
  const form = useCompanyForm({
    defaultValues: {
      displayName: profile.displayName,
      email: profile.email,
    },
  })

  useEffect(() => {
    if (!hydrated || initialized.current) return
    initialized.current = true
    form.reset(profile)
  }, [form, hydrated, profile])

  return (
    <SettingsPage
      title="Profile"
      description="Edit the profile presented by this browser's local Company OS session."
    >
      <SettingsSection
        title="Personal information"
        description="These values stay in this browser and do not create or modify a login account."
      >
        <form.AppField
          name="displayName"
          validators={{
            onBlur: ({ value }) =>
              value.trim() ? undefined : "Display name is required.",
          }}
        >
          {(field) => (
            <field.AutoSaveTextField
              label="Display name"
              description="Shown in the account menu and settings surfaces."
              layout="settings"
              committedValue={profile.displayName}
              normalize={(value) => value.trim()}
              input={{ autoComplete: "name", required: true }}
              onCommit={(displayName) => updateProfile({ displayName })}
            />
          )}
        </form.AppField>
        <form.AppField name="email">
          {(field) => (
            <field.AutoSaveTextField
              label="Email"
              description="Optional contact metadata for this local profile."
              layout="settings"
              committedValue={profile.email}
              normalize={(value) => value.trim()}
              input={{
                autoComplete: "email",
                placeholder: "Not configured",
                type: "email",
              }}
              onCommit={(email) => updateProfile({ email })}
            />
          )}
        </form.AppField>
      </SettingsSection>
    </SettingsPage>
  )
}
