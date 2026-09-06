import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { describeModel, lintModelDescription } from "@company/runtime"
import { Model } from "company-os/model"

const diagnostics = lintModelDescription(describeModel(Model))
for (const diagnostic of diagnostics) {
  process.stderr.write(
    `${diagnostic.ruleId} ${diagnostic.path.join(".")}: ${diagnostic.message}\n`
  )
}
if (diagnostics.some(({ severity }) => severity === "error")) {
  process.exitCode = 1
} else {
  process.stdout.write("Model policy verified.\n")
}

// The installed model determines the authoring layout; no second object inventory is maintained.
function requireSource(moduleId: string, filename: string) {
  const path = `../src/modules/${moduleId}/${filename}`
  if (!existsSync(fileURLToPath(new URL(path, import.meta.url)))) {
    throw new Error(`Missing conventional module source: ${path}`)
  }
}
function kebabCase(id: string) {
  return id.replaceAll(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()
}
for (const module of Object.values(Model.modules)) {
  const directory = kebabCase(module.id)
  requireSource(directory, "model.ts")
  for (const object of module.objects)
    requireSource(directory, `${kebabCase(object.id)}/model.ts`)
  for (const link of module.links)
    requireSource(directory, `links/${kebabCase(link.id)}.ts`)
  for (const face of module.interfaces)
    requireSource(directory, `interfaces/${kebabCase(face.id)}.ts`)
}
process.stdout.write("Module source layout verified.\n")
