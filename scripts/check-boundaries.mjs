import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
)
const errors = []

async function directories(directory) {
  return (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(directory, entry.name))
}

async function sourceFiles(directory) {
  const files = []

  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if ([".turbo", "dist", "node_modules"].includes(entry.name)) continue

    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await sourceFiles(entryPath)))
    } else if (/\.[cm]?[jt]sx?$/.test(entry.name)) {
      files.push(entryPath)
    }
  }

  return files
}

function packageNameFromSpecifier(specifier) {
  const match = specifier.match(/^(@[^/]+\/[^/]+)/)
  return match?.[1]
}

function forbiddenReason(packageName, specifier) {
  if (packageName.startsWith("@continual/") && specifier.startsWith("@acme/")) {
    return "reusable @continual packages cannot depend on customer-specific @acme packages"
  }

  if (
    packageName === "@continual/model" &&
    [
      "@continual/cli",
      "@continual/client",
      "@continual/runtime",
      "@continual/studio",
      "@continual/ui",
    ].some((name) => specifier.startsWith(name))
  ) {
    return "@continual/model must remain universal and independent of clients, UI, tooling, and server execution"
  }

  if (
    packageName === "@continual/client" &&
    [
      "@continual/cli",
      "@continual/runtime",
      "@continual/studio",
      "@continual/ui",
    ].some((name) => specifier.startsWith(name))
  ) {
    return "@continual/client must remain browser-safe and independent of runtime and presentation packages"
  }

  if (
    packageName === "@continual/runtime" &&
    [
      "@continual/cli",
      "@continual/client",
      "@continual/studio",
      "@continual/ui",
    ].some((name) => specifier.startsWith(name))
  ) {
    return "@continual/runtime may depend on the model, but not clients, React UI, or developer tooling"
  }

  if (
    packageName === "@continual/ui" &&
    ["@continual/cli", "@continual/runtime", "@continual/studio"].some((name) =>
      specifier.startsWith(name)
    )
  ) {
    return "@continual/ui is browser-safe reusable presentation and cannot depend on runtime or complete applications"
  }

  if (
    packageName === "@continual/studio" &&
    specifier.startsWith("@continual/runtime")
  ) {
    return "@continual/studio must inspect deployed Runtimes through @continual/client, never through server internals"
  }

  if (
    packageName === "@acme/model" &&
    [
      "@acme/client",
      "@acme/ui",
      "@continual/client",
      "@continual/runtime",
    ].some((name) => specifier.startsWith(name))
  ) {
    return "@acme/model is a public definition package and may depend only on @continual/model"
  }

  if (
    packageName === "@acme/client" &&
    specifier.startsWith("@continual/runtime")
  ) {
    return "@acme/client must remain browser-safe and cannot depend on the server runtime"
  }

  if (
    packageName === "@acme/ui" &&
    ["@continual/cli", "@continual/runtime", "@continual/studio"].some((name) =>
      specifier.startsWith(name)
    )
  ) {
    return "@acme/ui is browser-safe and cannot depend on server execution or developer applications"
  }

  if (
    packageName === "@acme/api" &&
    ["@continual/cli", "@continual/studio", "@continual/ui"].some((name) =>
      specifier.startsWith(name)
    )
  ) {
    return "the Acme API is headless and cannot embed developer tooling or React UI"
  }

  if (
    ["@acme/portal", "@acme/workspace", "@acme/website"].includes(
      packageName
    ) &&
    (specifier.startsWith("@continual/runtime") ||
      specifier.startsWith("@continual/studio") ||
      specifier.startsWith("@continual/cli") ||
      specifier.startsWith("@acme/api"))
  ) {
    return "frontend applications must use @acme/client instead of server packages"
  }
}

const appDirectories = await directories(path.join(repositoryRoot, "apps"))
const ownerDirectories = await directories(
  path.join(repositoryRoot, "packages")
)
const libraryDirectories = (
  await Promise.all(ownerDirectories.map((owner) => directories(owner)))
).flat()

for (const packageDirectory of [...appDirectories, ...libraryDirectories]) {
  const packagePath = path.join(packageDirectory, "package.json")
  const packageJson = JSON.parse(await readFile(packagePath, "utf8"))
  const packageName = packageJson.name
  const dependencyGroups = [
    packageJson.dependencies,
    packageJson.devDependencies,
    packageJson.optionalDependencies,
    packageJson.peerDependencies,
  ]
  const declaredDependencies = new Set(
    dependencyGroups.flatMap((group) => Object.keys(group ?? {}))
  )

  const relativePackagePath = path.relative(repositoryRoot, packageDirectory)
  const pathParts = relativePackagePath.split(path.sep)
  if (pathParts[0] === "packages") {
    const expectedName = `@${pathParts[1]}/${pathParts[2]}`
    if (packageName !== expectedName) {
      errors.push(
        `${relativePackagePath}: package name must be ${expectedName}, found ${packageName}`
      )
    }
  }

  for (const dependency of declaredDependencies) {
    const reason = forbiddenReason(packageName, dependency)
    if (reason) errors.push(`${packageName} -> ${dependency}: ${reason}`)
  }

  const sourceDirectory = path.join(packageDirectory, "src")
  let files = []
  try {
    files = await sourceFiles(sourceDirectory)
  } catch (error) {
    if (error.code !== "ENOENT") throw error
  }

  for (const file of files) {
    const source = await readFile(file, "utf8")
    const importPattern =
      /(?:from\s+|import\s*\(\s*|import\s+)["']([^"']+)["']/g

    for (const match of source.matchAll(importPattern)) {
      const specifier = match[1]
      const relativeFile = path.relative(repositoryRoot, file)

      if (specifier.startsWith(".")) {
        const resolvedImport = path.resolve(path.dirname(file), specifier)
        const packagePrefix = `${packageDirectory}${path.sep}`
        if (!resolvedImport.startsWith(packagePrefix)) {
          errors.push(
            `${relativeFile}: relative import crosses a package boundary (${specifier})`
          )
        }
        continue
      }

      const reason = forbiddenReason(packageName, specifier)
      if (reason) errors.push(`${relativeFile} -> ${specifier}: ${reason}`)

      const importedPackage = packageNameFromSpecifier(specifier)
      if (
        importedPackage &&
        importedPackage !== packageName &&
        !declaredDependencies.has(importedPackage)
      ) {
        errors.push(
          `${relativeFile}: ${importedPackage} is imported but not declared in ${packageName}`
        )
      }
    }
  }
}

if (errors.length > 0) {
  console.error(`Boundary check failed:\n\n${errors.join("\n")}`)
  process.exitCode = 1
} else {
  console.log("Package ownership and browser/server boundaries are valid.")
}
