// Adapted from continual-www/scripts/generate-social-card.mjs. The Prism image
// is an actual MeshGradient frame with grain, exported by generate-spectrum-assets.mjs.
// Run: pnpm generate:readme-banner /path/to/davinci/apps/continual-www
// Uses that checkout's brand assets and Sharp dependency; adds no app dependency.
import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"

if (!process.argv[2]) throw new Error("Pass the continual-www directory.")
const brandApp = path.resolve(process.argv[2])
const requireFromBrand = createRequire(path.join(brandApp, "package.json"))
const sharp = requireFromBrand("sharp")
const [logo, font] = await Promise.all([
  readFile(path.join(brandApp, "public/brand/continual-logo.svg"), "utf8"),
  readFile(
    requireFromBrand.resolve(
      "@fontsource-variable/geist/files/geist-latin-wght-normal.woff2"
    )
  ),
])

const overlay = Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="320" viewBox="0 0 1200 320">
    <style>
      @font-face {
        font-family: "Geist Banner";
        src: url("data:font/woff2;base64,${font.toString("base64")}") format("woff2");
        font-weight: 100 900;
      }
      text { font-family: "Geist Banner", Arial, sans-serif; }
    </style>
    <rect width="1200" height="320" fill="#fbfaf7" fill-opacity="0.16" />
    <text x="54" y="60" fill="#101114" font-size="26" font-weight="600" letter-spacing="-0.5">Company OS</text>
    <text x="1146" y="59" text-anchor="end" fill="#101114" fill-opacity="0.68" font-size="20">Open source</text>
    <g fill="#101114" font-size="70" font-weight="600" letter-spacing="-2">
      <text x="51" y="143">Build your company’s</text>
      <text x="51" y="225">AI-native operating system.</text>
    </g>
    <text x="54" y="286" fill="#101114" fill-opacity="0.68" font-size="16">By</text>
    <g transform="translate(80 267)">${logo}</g>
  </svg>
`)

const output = fileURLToPath(
  new URL("../docs/images/continual-banner.jpg", import.meta.url)
)
await sharp(path.join(brandApp, "public/brand/spectrum/prism.webp"))
  .resize(1200, 320, { fit: "cover", position: "centre" })
  .composite([{ input: overlay }])
  .jpeg({ chromaSubsampling: "4:4:4", mozjpeg: true, quality: 94 })
  .toFile(output)

console.log(`Generated ${output}`)
