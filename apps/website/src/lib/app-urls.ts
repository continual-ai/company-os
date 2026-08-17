const configuredPortalUrl = import.meta.env.VITE_PORTAL_URL?.trim()
const configuredWorkspaceUrl = import.meta.env.VITE_WORKSPACE_URL?.trim()

export const portalUrl =
  configuredPortalUrl ||
  (import.meta.env.DEV ? "http://localhost:3001" : "/portal")

export const workspaceUrl =
  configuredWorkspaceUrl ||
  (import.meta.env.DEV ? "http://localhost:3002" : "/workspace")
