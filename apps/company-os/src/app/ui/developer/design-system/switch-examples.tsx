import { Label } from "@company/ui/label"
import { Switch } from "@company/ui/switch"

import {
  Example,
  type ComponentSection,
} from "#/app/ui/developer/design-system/example.tsx"

export const switchPage: ComponentSection = {
  id: "switch",
  title: "Switch",
  description:
    "An immediate on/off preference. Blue indicates enabled; actions and surrounding surfaces remain neutral.",
  component: SwitchExamples,
  usage:
    'import { Switch } from "@company/ui/switch"\nimport { Label } from "@company/ui/label"\n\n<Label htmlFor="updates">Notify me about updates</Label>\n<Switch id="updates" defaultChecked />',
}

function SwitchExamples() {
  return (
    <>
      <Example title="Preferences" source="@company/ui/switch">
        <div className="max-w-lg divide-y">
          <div className="flex items-center justify-between gap-4 pb-4">
            <Label htmlFor="ds-switch-on">Notify me about updates</Label>
            <Switch id="ds-switch-on" defaultChecked />
          </div>
          <div className="flex items-center justify-between gap-4 py-4">
            <Label htmlFor="ds-switch-off">Include archived records</Label>
            <Switch id="ds-switch-off" />
          </div>
          <div className="flex items-center justify-between gap-4 pt-4">
            <Label htmlFor="ds-switch-disabled">Managed preference</Label>
            <Switch id="ds-switch-disabled" defaultChecked disabled />
          </div>
        </div>
      </Example>
      <Example title="Compact" source="@company/ui/switch">
        <Label htmlFor="ds-switch-small">
          <Switch id="ds-switch-small" size="sm" defaultChecked />
          Compact control
        </Label>
      </Example>
    </>
  )
}
