import { modelMetadata } from "@company/model/metadata"

type BrandAsset = Readonly<{
  alt: string
  src: string
}>

type SignInMedia =
  | Readonly<{
      alt: string
      kind: "image"
      src: string
    }>
  | Readonly<{
      kind: "video"
      poster: string
      src: string
    }>

type CompanyConfig = Readonly<{
  brand: Readonly<{
    favicon: Readonly<{ href: string; type: string }>
    logo: BrandAsset | null
    mark: BrandAsset | null
    signInMedia: SignInMedia | null
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
  signIn: Readonly<{
    description: string
    headline: string
    highlights: ReadonlyArray<string>
  }>
}>

const companyName = modelMetadata.name

/** Shallow company identity and first-launch copy; workflows remain ordinary source code. */
export const companyConfig: CompanyConfig = {
  brand: {
    favicon: { href: "/favicon.svg", type: "image/svg+xml" },
    logo: null,
    mark: null,
    signInMedia: null,
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
  signIn: {
    description:
      "Start with one important operation, then build outward on the same source-owned foundation.",
    headline: "Run the work from one shared operating system.",
    highlights: [
      "Company data and relationships share one typed model.",
      "People, applications, integrations, and agents use governed actions.",
      "The source and operating history remain under the company’s control.",
    ],
  },
}
