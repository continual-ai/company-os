import { modelMetadata } from "@company/model/metadata"

type BrandAsset = Readonly<{
  alt: string
  src: string
}>

type CompanyConfig = Readonly<{
  brand: Readonly<{
    favicon: Readonly<{ href: string; type: string }>
    mark: BrandAsset | null
    themeColor: string
  }>
  home: Readonly<{
    description: string
    eyebrow: string
    headline: string
  }>
  identity: Readonly<{
    companyName: string
    descriptor: string
    monogram: string
    productName: string
  }>
}>

const companyName = modelMetadata.name

/** Shallow company identity and first-launch copy; workflows remain ordinary source code. */
export const companyConfig: CompanyConfig = {
  brand: {
    favicon: { href: "/favicon.svg", type: "image/svg+xml" },
    mark: null,
    themeColor: "#ffffff",
  },
  home: {
    description:
      "The same typed definitions and governed capabilities serve people, applications, integrations, and agents.",
    eyebrow: "Operating overview",
    headline: "Run the work from shared business context.",
  },
  identity: {
    companyName,
    descriptor: "Company operating system",
    monogram: companyName.slice(0, 1).toUpperCase(),
    productName: `${companyName} OS`,
  },
}
