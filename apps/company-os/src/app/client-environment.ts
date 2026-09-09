/** Public, build-time configuration safe to include in browser code. */
export function appUrl(): string | undefined {
  const configured = import.meta.env.VITE_APP_URL?.trim()
  return configured === "" ? undefined : configured
}
