import type { Model } from "#/app.model.ts"

/**
 * Deployment identity shared by the model, the UI, generated protocol
 * adapters, and optional apps. Change the name and currency here when
 * adopting the application for a company.
 */
export const appMetadata = {
  id: "application",
  name: "Example",
  version: "0.0.0",
  defaultCurrency: "USD",
} as const

/**
 * Modules the UI and API expose. Every module in app.model.ts stays composed and
 * migrated, so removing an id here hides a capability without touching its data.
 * Two deployments with different lists are two commits, never an environment switch.
 */
export const enabledModules = [
  "access",
  "assets",
  "notes",
  "sales",
  "marketing",
  "engineering",
  "support",
  "supportEngineering",
] as const satisfies ReadonlyArray<keyof (typeof Model)["modules"]>
