/** Animate navigation, not incidental URL updates such as filters or sorting. */
export function navigationTransitionTypes({
  pathChanged,
  fromLocation,
  toLocation,
}: {
  readonly pathChanged: boolean
  readonly fromLocation?:
    | { readonly search: Record<string, unknown> }
    | undefined
  readonly toLocation: { readonly search: Record<string, unknown> }
}): string[] | false {
  if (
    typeof window === "undefined" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    !fromLocation
  )
    return false

  if (pathChanged) return ["page"]
  if (
    (fromLocation.search.tab ?? "overview") !==
    (toLocation.search.tab ?? "overview")
  )
    return ["tab"]
  return false
}
