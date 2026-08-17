const configuredClientPortalUrl = import.meta.env.VITE_CLIENT_PORTAL_URL?.trim()
const configuredCompanyOsUrl = import.meta.env.VITE_COMPANY_OS_URL?.trim()

export const clientPortalUrl =
  configuredClientPortalUrl ||
  (import.meta.env.DEV ? "http://localhost:3001" : "/client-portal")

export const companyOsUrl =
  configuredCompanyOsUrl ||
  (import.meta.env.DEV ? "http://localhost:3002" : "/company-os")
