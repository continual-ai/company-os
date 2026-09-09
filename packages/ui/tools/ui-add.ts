import { spawnSync } from "node:child_process"
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

// Adds shadcn components into src/components through the CLI, then makes the
// result match this repository: `#/` imports get the explicit extensions the
// lint rules require, and `cn` comes from the source-owned src/lib/utils.ts
// instead of the `cn` npm package the registry declares.
const app = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const source = join(app, "src")
const components = join(source, "components")
// pnpm forwards a literal "--" when the root script delegates to this one.
const names = process.argv.slice(2).filter((argument) => argument !== "--")
if (names.length === 0) {
  process.stderr.write("Usage: pnpm ui:add <component> [component...]\n")
  process.exit(1)
}

function snapshot(): Map<string, number> {
  return new Map(
    readdirSync(components).map((file) => [
      file,
      statSync(join(components, file)).mtimeMs,
    ])
  )
}

const manifestPath = join(app, "package.json")
const manifestBefore = readFileSync(manifestPath, "utf8")
const before = snapshot()
const result = spawnSync(
  "pnpm",
  ["exec", "shadcn", "add", "--yes", "--overwrite", ...names],
  { cwd: app, stdio: "inherit" }
)
if (result.status !== 0) process.exit(result.status ?? 1)

const SPECIFIER = /(from\s*|import\s*\(?\s*)"(#\/[^"]+)"/g
const CN_PACKAGE_IMPORT = /import\s*\{\s*cn\s*\}\s*from\s*"cn"/g
const UTILS = "#/lib/utils.ts"
function withExtension(specifier: string): string {
  if (/\.(?:tsx?|css|json)(?:\?.*)?$/.test(specifier)) return specifier
  const base = join(source, specifier.slice(2))
  for (const extension of [".ts", ".tsx"])
    if (existsSync(base + extension)) return specifier + extension
  if (existsSync(base) && statSync(base).isDirectory())
    for (const extension of [".ts", ".tsx"])
      if (existsSync(join(base, `index${extension}`)))
        return `${specifier}/index${extension}`
  return specifier
}

const changed = [...snapshot()].filter(
  ([file, modified]) => before.get(file) !== modified
)
for (const [file] of changed) {
  const path = join(components, file)
  const content = readFileSync(path, "utf8")
  const next = content
    .replace(CN_PACKAGE_IMPORT, `import { cn } from "${UTILS}"`)
    .replace(
      SPECIFIER,
      (_match, lead: string, specifier: string) =>
        `${lead}"${withExtension(specifier)}"`
    )
  if (next !== content) writeFileSync(path, next)
}
// The registry declares the `cn` npm package; this package owns `cn` in
// src/lib/utils.ts. Restoring the manifest entry and reinstalling keeps
// the lockfile in sync without a full re-resolution.
const manifest: { dependencies?: Record<string, string> } = JSON.parse(
  readFileSync(manifestPath, "utf8")
)
if (
  manifest.dependencies?.["cn"] !== undefined &&
  !JSON.parse(manifestBefore).dependencies?.["cn"]
) {
  delete manifest.dependencies["cn"]
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  spawnSync("pnpm", ["install"], { cwd: app, stdio: "inherit" })
}
spawnSync(
  "pnpm",
  ["exec", "oxfmt", ...changed.map(([file]) => join(components, file))],
  {
    cwd: app,
    stdio: "inherit",
  }
)
process.stdout.write(
  `Added ${changed.map(([file]) => file).join(", ")}. Run pnpm check; unused components fail dead-code detection.\n`
)
