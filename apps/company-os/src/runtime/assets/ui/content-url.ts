/** Stable authorized delivery path; never persist provider-specific URLs. */
export function assetContentUrl(assetId: string) {
  return `/api/v1/assets/${encodeURIComponent(assetId)}/content`
}
