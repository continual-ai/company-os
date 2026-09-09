import {
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

// Removes a shadcn component file after proving nothing imports it. Importers
// are listed instead of deleted, so a removal never silently breaks a screen.
const app = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const source = join(app, "src")
// pnpm forwards a literal "--" when the root script delegates to this one.
const names = process.argv.slice(2).filter((argument) => argument !== "--")
if (names.length === 0) {
  process.stderr.write("Usage: pnpm ui:remove <component> [component...]\n")
  process.exit(1)
}

function* sourceFiles(directory: string): Generator<string> {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry)
    if (statSync(path).isDirectory()) yield* sourceFiles(path)
    else if (/\.tsx?$/.test(entry)) yield path
  }
}

let failed = false
for (const name of names) {
  const file = join(source, "runtime/ui/components", `${name}.tsx`)
  if (!existsSync(file)) {
    process.stderr.write(`No component at ${relative(app, file)}.\n`)
    failed = true
    continue
  }
  const specifier = `#/runtime/ui/components/${name}.tsx`
  const importers = [...sourceFiles(source)]
    .filter((path) => path !== file)
    .filter((path) => readFileSync(path, "utf8").includes(`"${specifier}"`))
  if (importers.length > 0) {
    process.stderr.write(
      `${name} is still imported by:\n${importers
        .map((path) => `  ${relative(app, path)}`)
        .join("\n")}\nRemove those imports first.\n`
    )
    failed = true
    continue
  }
  rmSync(file)
  process.stdout.write(`Removed ${relative(app, file)}.\n`)
}
process.exit(failed ? 1 : 0)
