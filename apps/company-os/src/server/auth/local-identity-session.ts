export function localIdentityProfileId(
  headers: Headers,
  cookieName: string
): string | undefined {
  const header = headers.get("cookie")
  if (header === null) return undefined
  for (const item of header.split(";")) {
    const separator = item.indexOf("=")
    if (separator === -1 || item.slice(0, separator).trim() !== cookieName) {
      continue
    }
    const value = item.slice(separator + 1).trim()
    try {
      return decodeURIComponent(value)
    } catch {
      return undefined
    }
  }
  return undefined
}

export function localIdentitySessionCookie(
  cookieName: string,
  profileId?: string
): string {
  const value = profileId === undefined ? "" : encodeURIComponent(profileId)
  const expiration = profileId === undefined ? "; Max-Age=0" : ""
  return `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Lax${expiration}`
}
