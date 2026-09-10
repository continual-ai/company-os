/**
 * Deployment identity shared by the model, the UI, generated protocol
 * adapters, and optional apps. Change the name and currency here when
 * adopting the application for a company.
 */
export const appMetadata = {
  id: "application",
  name: "Company OS",
  version: "0.0.0",
  defaultCurrency: "USD",
  // Set your team here when adopting the app; modules may override this contact.
  maintainer: { name: "Company OS contributors" },
} as const
