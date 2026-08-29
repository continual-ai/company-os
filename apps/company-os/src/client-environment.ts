/** Public, build-time configuration safe to include in browser code. */
export function companyOsUrl(): string | undefined {
  const configured = import.meta.env.VITE_COMPANY_OS_URL?.trim()
  return configured === "" ? undefined : configured
}
