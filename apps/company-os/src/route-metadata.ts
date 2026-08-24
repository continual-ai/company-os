import { modelMetadata } from "@company/model/metadata"

import { appMetadata } from "@/app-metadata"

export type PageMetadata = {
  breadcrumb: string
  description: string
  section?: string
  title: string
}

export type DocumentMetadata = {
  description: string
  section?: string
  title: string
}

export const appName = `${modelMetadata.name} ${appMetadata.name}`

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    page?: PageMetadata
  }
}

type PageMatch = {
  loaderData?: { page?: PageMetadata } | undefined
  pathname: string
  staticData: { page?: PageMetadata }
}

export function pageOptions(page: PageMetadata) {
  return { staticData: { page } }
}

export function pageMetadataForMatch(match: PageMatch) {
  return match.loaderData?.page ?? match.staticData.page
}

export function resolvePageMetadata(matches: ReadonlyArray<PageMatch>) {
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const match = matches[index]
    if (!match) continue

    const page = pageMetadataForMatch(match)
    if (page) return page
  }

  return undefined
}

export function documentHead(document: DocumentMetadata) {
  const title =
    document.title === appName
      ? appName
      : [document.title, document.section, appName].filter(Boolean).join(" | ")
  const meta = [
    { title },
    { name: "description", content: document.description },
    { property: "og:title", content: title },
    { property: "og:description", content: document.description },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: appName },
    { name: "twitter:card", content: "summary" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: document.description },
  ]

  return { meta }
}

export function canonicalMetadata(path: string) {
  const canonicalPath = path === "/" ? path : path.replace(/\/+$/, "")
  const canonicalUrl = absoluteSiteUrl(canonicalPath)

  return canonicalUrl
    ? {
        meta: [{ property: "og:url", content: canonicalUrl }],
        links: [{ rel: "canonical", href: canonicalUrl }],
      }
    : {}
}

function absoluteSiteUrl(path: string | undefined) {
  const configuredSiteUrl = import.meta.env.VITE_COMPANY_OS_URL?.trim()
  if (!configuredSiteUrl || !path) return undefined

  return new URL(path, configuredSiteUrl).toString()
}
