import { modelMetadata } from "#/model-metadata.ts"

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

type AppConfig = Readonly<{
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
    descriptor: string
    monogram: string
    name: string
  }>
}>

const appName = modelMetadata.name

/** Shallow application identity and first-launch copy; workflows remain source code. */
export const appConfig: AppConfig = {
  brand: {
    favicon: { href: "/favicon.svg", type: "image/svg+xml" },
    mark: null,
    themeColor: "#ffffff",
  },
  entry: {
    description:
      "Keep records, decisions, and work together in one shared workspace.",
    eyebrow: appName,
    headline: "One place to run the work that matters.",
    highlights: [
      "Find the context behind each record",
      "Coordinate work across your team",
      "Adapt the app as your process changes",
    ],
    media: null,
  },
  home: {
    description: "Track work, manage records, and follow what needs attention.",
    eyebrow: appName,
    headline: "Workspace",
  },
  identity: {
    descriptor: "Shared workspace",
    monogram: appName.slice(0, 1).toUpperCase(),
    name: appName,
  },
}
