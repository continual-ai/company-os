import { modelMetadata } from "@company/model/metadata"

type BrandAsset = Readonly<{
  alt: string
  src: string
}>

type EntryMedia =
  | Readonly<{
      kind: "image"
      position?: string
      src: string
    }>
  | Readonly<{
      kind: "video"
      position?: string
      poster: string
      src: string
    }>

type ApplicationConfig = Readonly<{
  brand: Readonly<{
    favicon: Readonly<{ href: string; type: string }>
    mark: BrandAsset | null
    themeColor: string
  }>
  entry: Readonly<{
    description: string
    eyebrow: string
    headline: string
    highlights: ReadonlyArray<string>
    media: EntryMedia | null
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

/** Shallow application identity and first-launch copy; workflows remain source code. */
export const applicationConfig: ApplicationConfig = {
  brand: {
    favicon: { href: "/favicon.svg", type: "image/svg+xml" },
    mark: null,
    themeColor: "#ffffff",
  },
  entry: {
    description:
      "Bring company context, governed operations, and the tools to keep improving them into one shared system.",
    eyebrow: `${companyName} OS`,
    headline: "One place to run the work that matters.",
    highlights: [
      "Work from shared company context",
      "Turn repeatable decisions into governed operations",
      "Extend the same foundation as the company evolves",
    ],
    media: null,
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
