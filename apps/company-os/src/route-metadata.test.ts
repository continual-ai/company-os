import { afterEach, describe, expect, it, vi } from "vitest"

import {
  canonicalMetadata,
  documentHead,
  pageMetadataForMatch,
  pageOptions,
  resolvePageMetadata,
} from "./route-metadata"
import type { PageMetadata } from "./route-metadata"

const overview = {
  breadcrumb: "Overview",
  description: "Review the company operating overview.",
  title: "Overview",
} satisfies PageMetadata

const customer = {
  breadcrumb: "Acme Corporation",
  description: "Review Acme Corporation.",
  title: "Acme Corporation",
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
    vi.stubEnv("VITE_COMPANY_OS_URL", "https://os.example.com")

    const document = documentHead({
      ...customer,
      section: "Customers",
    })

    expect(document.meta).toContainEqual({
      title: "Acme Corporation | Customers | Acme Company OS",
    })
    expect(document.meta).toContainEqual({
      name: "description",
      content: customer.description,
    })
    expect(document.meta).toContainEqual({
      property: "og:image",
      content: "https://os.example.com/social-card.png",
    })
  })

  it("omits deployment URLs when the public origin is not configured", () => {
    vi.stubEnv("VITE_COMPANY_OS_URL", "")

    expect(documentHead(overview).meta).toContainEqual({
      name: "twitter:card",
      content: "summary",
    })
    expect(canonicalMetadata("/overview")).toEqual({})
  })

  it("normalizes index-route trailing slashes in canonical URLs", () => {
    vi.stubEnv("VITE_COMPANY_OS_URL", "https://os.example.com")

    expect(canonicalMetadata("/develop/")).toEqual({
      meta: [
        {
          property: "og:url",
          content: "https://os.example.com/develop",
        },
      ],
      links: [
        {
          rel: "canonical",
          href: "https://os.example.com/develop",
        },
      ],
    })
  })
})
