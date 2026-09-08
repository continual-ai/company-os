const configuredClientPortalUrl = import.meta.env.VITE_CLIENT_PORTAL_URL?.trim()
const configuredAppUrl = import.meta.env.VITE_APP_URL?.trim()

export const clientPortalUrl =
  configuredClientPortalUrl ||
  (import.meta.env.DEV ? "http://localhost:3001" : "/client-portal")

export const appUrl =
  configuredAppUrl ||
  (import.meta.env.DEV ? "http://localhost:3002" : "/company-os")
