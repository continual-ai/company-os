import { existsSync, readFileSync } from "node:fs"
import { dirname, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { parseSync } from "oxc-parser"

const app = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const visited = new Set<string>()

function visit(filename: string): void {
  if (visited.has(filename)) return
  visited.add(filename)
  const parsed = parseSync(filename, readFileSync(filename, "utf8"))
  if (parsed.errors.length > 0) throw new Error(`Cannot parse ${filename}`)
  if (parsed.module.dynamicImports.length > 0)
    throw new Error(
      `Dynamic imports are not allowed in model definitions: ${filename}`
    )
  for (const { moduleRequest } of [
    ...parsed.module.staticImports,
    ...parsed.module.staticExports
      .flatMap((entry) => entry.entries)
      .filter((entry) => entry.moduleRequest !== null),
  ]) {
    if (moduleRequest === null) continue
    const specifier = moduleRequest.value
    if (specifier === "@company/runtime") continue
    const base =
      specifier === "#root"
        ? resolve(app, "src/model-root")
        : specifier.startsWith("#modules/")
          ? resolve(app, "src/modules", specifier.slice(9))
          : specifier.startsWith(".")
            ? resolve(dirname(filename), specifier)
            : undefined
    const resolved =
      base === undefined
        ? undefined
        : [base, `${base}.ts`, `${base}.tsx`].find(existsSync)
    if (
      !resolved ||
      !resolved.startsWith(`${app}/src/`) ||
      resolved.includes("/server/") ||
      /\/(?:server|ui)\.ts$/.test(resolved) ||
      /\.(?:server|client)\.[jt]sx?$/.test(resolved) ||
      resolved.includes("/ui/") ||
      resolved.endsWith(".tsx")
    ) {
      throw new Error(
        `${relative(app, filename)} imports ${specifier}: model imports must remain browser-safe definitions inside the application or @company/runtime.`
      )
    }
    visit(resolved)
  }
}

visit(resolve(app, "src/model.ts"))
visit(resolve(app, "src/model-metadata.ts"))
process.stdout.write(
  `Model boundary verified across ${visited.size} modules.\n`
)
