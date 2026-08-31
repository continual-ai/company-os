import { describe, expect, it } from "vitest"

import {
  documentHead,
  pageMetadataForMatch,
  pageOptions,
  resolvePageMetadata,
} from "./route-metadata"
import type { PageMetadata } from "./route-metadata"
import { appName } from "./route-metadata"

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

  it("does not publish deployment-specific URLs", () => {
    expect(documentHead(overview).meta).toContainEqual({
      name: "twitter:card",
      content: "summary",
    })
    expect(documentHead(overview).meta).not.toContainEqual(
      expect.objectContaining({ property: "og:url" })
    )
  })
})
