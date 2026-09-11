// Adapted from continual-www/scripts/generate-social-card.mjs. The Prism image
// is an actual MeshGradient frame with grain, exported by generate-spectrum-assets.mjs.
// Run: pnpm generate:readme-banner /path/to/davinci/apps/continual-www
// Add --social-preview to generate the 1280×640 GitHub social card.
// Uses that checkout's brand assets and Sharp dependency; adds no app dependency.
import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"

if (!process.argv[2]) throw new Error("Pass the continual-www directory.")
const brandApp = path.resolve(process.argv[2])
const requireFromBrand = createRequire(path.join(brandApp, "package.json"))
const sharp = requireFromBrand("sharp")
const socialPreview = process.argv.includes("--social-preview")
const width = socialPreview ? 1280 : 1200
const height = socialPreview ? 640 : 320
const [logo, font] = await Promise.all([
  readFile(path.join(brandApp, "public/brand/continual-logo.svg"), "utf8"),
  readFile(
    requireFromBrand.resolve(
      "@fontsource-variable/geist/files/geist-latin-wght-normal.woff2"
    )
  ),
])

const overlay = Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <style>
      @font-face {
        font-family: "Geist Banner";
        src: url("data:font/woff2;base64,${font.toString("base64")}") format("woff2");
        font-weight: 100 900;
      }
      text { font-family: "Geist Banner", Arial, sans-serif; }
    </style>
    <rect width="${width}" height="${height}" fill="#fbfaf7" fill-opacity="0.16" />
    ${
      socialPreview
        ? `
    <text x="72" y="105" fill="#101114" font-size="38" font-weight="600" letter-spacing="-0.8">Company OS</text>
    <text x="1208" y="102" text-anchor="end" fill="#101114" fill-opacity="0.68" font-size="24">Open source</text>
    <g fill="#101114" font-size="82" font-weight="600" letter-spacing="-2.4">
      <text x="68" y="270">The agent-first operating</text>
      <text x="68" y="367">system for your business.</text>
    </g>
    <text x="72" y="566" fill="#101114" fill-opacity="0.68" font-size="22">By</text>
    <g transform="translate(110 540) scale(1.4)">${logo}</g>
    <text x="1208" y="566" text-anchor="end" fill="#101114" fill-opacity="0.68" font-size="24">continual.ai</text>
    `
        : `
    <text x="54" y="60" fill="#101114" font-size="26" font-weight="600" letter-spacing="-0.5">Company OS</text>
    <g fill="#101114" font-size="64" font-weight="600" letter-spacing="-1.8">
      <text x="51" y="143">The agent-first operating system</text>
      <text x="51" y="215">for your business.</text>
    </g>
    <text x="54" y="286" fill="#101114" fill-opacity="0.68" font-size="16">By</text>
    <g transform="translate(80 267)">${logo}</g>
    `
    }
  </svg>
`)

const output = fileURLToPath(
  new URL(
    socialPreview
      ? "../docs/images/company-os-social-preview.jpg"
      : "../docs/images/continual-banner.png",
    import.meta.url
  )
)
// Bake transparent corners into the asset so they survive GitHub's HTML sanitization.
const roundedMask = Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="320">
    <rect width="1200" height="320" rx="16" fill="white" />
  </svg>
`)
const rendered = sharp(path.join(brandApp, "public/brand/spectrum/prism.webp"))
  .resize(width, height, { fit: "cover", position: "centre" })
  .composite(
    socialPreview
      ? [{ input: overlay }]
      : [{ input: overlay }, { input: roundedMask, blend: "dest-in" }]
  )

if (socialPreview) {
  await rendered
    .jpeg({ quality: 94, chromaSubsampling: "4:4:4", mozjpeg: true })
    .toFile(output)
} else {
  await rendered.png({ compressionLevel: 9 }).toFile(output)
}

console.log(`Generated ${output}`)
