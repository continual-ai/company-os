import { Button } from "@company/ui/components/button"
import { createFileRoute } from "@tanstack/react-router"
import { useEffect, useState } from "react"

import {
  SettingsPage,
  SettingsRow,
  SettingsSection,
} from "@/components/settings-page"
import { pageOptions } from "@/route-metadata"

const page = {
  breadcrumb: "Appearance",
  description: "Choose how this app appears in this browser.",
  title: "Appearance settings",
}

const themeStorageKey = "company-os-theme"
const themes = ["Light", "System", "Dark"] as const
type Theme = (typeof themes)[number]

export const Route = createFileRoute("/_app/settings/appearance")({
  ...pageOptions(page),
  component: AppearanceSettings,
})

function applyTheme(theme: Theme) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
  document.documentElement.classList.toggle(
    "dark",
    theme === "Dark" || (theme === "System" && prefersDark)
  )
  document.documentElement.style.colorScheme =
    theme === "System" ? "light dark" : theme.toLowerCase()
}

function AppearanceSettings() {
  const [theme, setTheme] = useState<Theme>("System")

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(themeStorageKey)
    const nextTheme = themes.find((value) => value === storedTheme) ?? "System"
    setTheme(nextTheme)
    applyTheme(nextTheme)
  }, [])

  return (
    <SettingsPage
      title="Appearance"
      description="Choose a local presentation for this interface."
    >
      <SettingsSection title="Interface">
        <SettingsRow
          title="Theme"
          description="Use a light or dark interface, or follow the operating system."
        >
          <div
            className="flex rounded-sm border border-border/60 p-0.5"
            aria-label="Theme"
          >
            {themes.map((option) => (
              <Button
                key={option}
                variant={option === theme ? "secondary" : "ghost"}
                size="sm"
                aria-pressed={option === theme}
                onClick={() => {
                  setTheme(option)
                  applyTheme(option)
                  window.localStorage.setItem(themeStorageKey, option)
                }}
              >
                {option}
              </Button>
            ))}
          </div>
        </SettingsRow>
      </SettingsSection>
    </SettingsPage>
  )
}
