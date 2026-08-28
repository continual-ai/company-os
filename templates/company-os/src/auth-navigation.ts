export function safeReturnTo(value: string | undefined): string {
  if (value === undefined || !value.startsWith("/") || value.startsWith("//")) {
    return "/"
  }
  const url = new URL(value, "https://company-os.invalid")
  return `${url.pathname}${url.search}${url.hash}`
}
