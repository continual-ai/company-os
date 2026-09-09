import { afterEach, describe, expect, it, vi } from "vitest"

import {
  canonicalMetadata,
  documentHead,
  pageMetadataForMatch,
  pageOptions,
  resolvePageMetadata,
} from "#/app/ui/route-metadata.ts"
import type { PageMetadata } from "#/app/ui/route-metadata.ts"
import { appName } from "#/app/ui/route-metadata.ts"

const overview = {
  breadcrumb: "Overview",
  description: "Review the company operating overview.",
  title: "Overview",
} satisfies PageMetadata

const customer = {
  breadcrumb: "Example Corporation",
  description: "Review Example Corporation.",
  title: "Example Corporation",
} satisfies PageMetadata

afterEach(() => vi.unstubAllEnvs())

describe("page metadata", () => {
  it("keeps static page metadata in TanStack staticData", () => {
    expect(pageOptions(overview)).toEqual({ staticData: { page: overview } })
  })

  it("prefers loader metadata for a dynamic route match", () => {
    expect(
      pageMetadataForMatch({
        loaderData: { page: customer },
        pathname: "/customers/customer_1",
        staticData: { page: overview },
      })
    ).toEqual(customer)
  })

  it("uses the deepest matched page metadata", () => {
    expect(
      resolvePageMetadata([
        {
          loaderData: undefined,
          pathname: "/",
          staticData: { page: overview },
        },
        {
          loaderData: { page: customer },
          pathname: "/customers/customer_1",
          staticData: {},
        },
      ])
    ).toEqual(customer)
  })

  it("falls back to staticData when the loader does not provide a page", () => {
    expect(
      pageMetadataForMatch({
        loaderData: {},
        pathname: "/overview",
        staticData: { page: overview },
      })
    ).toEqual(overview)
  })
})

describe("document metadata", () => {
  it("builds the title, description, and social metadata from one page", () => {
    vi.stubEnv("VITE_APP_URL", "https://os.example.com")

    const document = documentHead({
      ...customer,
      section: "Customers",
    })

    expect(document.meta).toContainEqual({
      title: `Example Corporation | Customers | ${appName}`,
    })
    expect(document.meta).toContainEqual({
      name: "description",
      content: customer.description,
    })
    expect(document.meta).not.toContainEqual(
      expect.objectContaining({ property: "og:image" })
    )
  })

  it("omits deployment URLs when the public origin is not configured", () => {
    vi.stubEnv("VITE_APP_URL", "")

    expect(documentHead(overview).meta).toContainEqual({
      name: "twitter:card",
      content: "summary",
    })
    expect(canonicalMetadata("/overview")).toEqual({})
  })

  it("normalizes index-route trailing slashes in canonical URLs", () => {
    vi.stubEnv("VITE_APP_URL", "https://os.example.com")

    expect(canonicalMetadata("/developer/")).toEqual({
      meta: [
        {
          property: "og:url",
          content: "https://os.example.com/developer",
        },
      ],
      links: [
        {
          rel: "canonical",
          href: "https://os.example.com/developer",
        },
      ],
    })
  })
})
