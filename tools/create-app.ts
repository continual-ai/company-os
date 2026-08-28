import { spawnSync } from "node:child_process"
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs"
import { basename, dirname, relative, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"

import { Schema } from "effect"

interface TemplateManifest {
  readonly bootstrapCommands: ReadonlyArray<readonly [string, ...string[]]>
  readonly destination: string
  readonly environmentExample?: string | undefined
  readonly id: string
  readonly package: {
    readonly name: string
    readonly scripts: Readonly<Record<string, string>>
  }
  readonly replacements: ReadonlyArray<{
    readonly files: ReadonlyArray<string>
    readonly from: string
    readonly to: string
  }>
}

const nonEmptyStringSchema = Schema.String.check(Schema.isNonEmpty())
const templateManifestSchema = Schema.Struct({
  bootstrapCommands: Schema.Array(
    Schema.Array(nonEmptyStringSchema).check(Schema.isMinLength(1))
  ),
  destination: nonEmptyStringSchema,
  environmentExample: Schema.optionalKey(nonEmptyStringSchema),
  id: nonEmptyStringSchema,
  package: Schema.Struct({
    name: nonEmptyStringSchema,
    scripts: Schema.Record(nonEmptyStringSchema, nonEmptyStringSchema),
  }),
  replacements: Schema.optionalKey(
    Schema.Array(
      Schema.Struct({
        files: Schema.Array(nonEmptyStringSchema).check(Schema.isMinLength(1)),
        from: nonEmptyStringSchema,
        to: Schema.String,
      })
    )
  ),
})
const dependencyMapSchema = Schema.Record(
  nonEmptyStringSchema,
  nonEmptyStringSchema
)
const packageJsonSchema = Schema.Struct({
  dependencies: Schema.optionalKey(dependencyMapSchema),
  devDependencies: Schema.optionalKey(dependencyMapSchema),
  name: nonEmptyStringSchema,
  private: Schema.Boolean,
  scripts: Schema.Record(nonEmptyStringSchema, nonEmptyStringSchema),
  type: nonEmptyStringSchema,
  version: nonEmptyStringSchema,
})

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const templatesDirectory = resolve(repositoryRoot, "templates")
const ignoredDirectoryNames = new Set([
  ".output",
  ".tanstack",
  ".turbo",
  "dist",
  "node_modules",
])
const ignoredFileNames = new Set([
  ".env.local",
  ".env.template",
  ".env.template.local",
  "template.json",
])

function fail(message: string): never {
  throw new Error(message)
}

function manifest(templateId: string): TemplateManifest {
  const path = resolve(templatesDirectory, templateId, "template.json")
  if (!existsSync(path)) fail(`Unknown app template '${templateId}'.`)
  const decoded = Schema.decodeUnknownSync(templateManifestSchema)(
    JSON.parse(readFileSync(path, "utf8"))
  )
  return {
    ...decoded,
    bootstrapCommands: decoded.bootstrapCommands.map((command) => {
      const [executable, ...args] = command
      if (executable === undefined) fail("Bootstrap command cannot be empty.")
      return [executable, ...args] as const
    }),
    replacements: decoded.replacements ?? [],
  }
}

function templateIds(): ReadonlyArray<string> {
  const ids = readdirSync(templatesDirectory, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        existsSync(resolve(templatesDirectory, entry.name, "template.json"))
    )
    .map(({ name }) => name)
  // This array is a fresh list owned by the CLI.
  // oxlint-disable-next-line unicorn/no-array-sort
  return ids.sort()
}

function shouldCopy(source: string): boolean {
  const path = relative(templatesDirectory, source)
  const parts = path.split(sep)
  return (
    !parts.some((part) => ignoredDirectoryNames.has(part)) &&
    !ignoredFileNames.has(basename(source))
  )
}

function rewritePackage(destination: string, definition: TemplateManifest) {
  const path = resolve(destination, "package.json")
  const packageJson = Schema.decodeUnknownSync(packageJsonSchema)(
    JSON.parse(readFileSync(path, "utf8"))
  )
  writeFileSync(
    path,
    `${JSON.stringify(
      {
        ...packageJson,
        name: definition.package.name,
        scripts: definition.package.scripts,
      },
      null,
      2
    )}\n`
  )
}

function applyReplacements(
  destination: string,
  replacements: TemplateManifest["replacements"]
) {
  for (const replacement of replacements) {
    for (const file of replacement.files) {
      const path = resolve(destination, file)
      const contents = readFileSync(path, "utf8")
      if (!contents.includes(replacement.from)) {
        fail(
          `Expected '${replacement.from}' in ${relative(repositoryRoot, path)}.`
        )
      }
      writeFileSync(path, contents.replaceAll(replacement.from, replacement.to))
    }
  }
}

function run(command: readonly [string, ...string[]]) {
  const [executable, ...args] = command
  const result = spawnSync(executable, args, {
    cwd: repositoryRoot,
    stdio: "inherit",
  })
  if (result.status !== 0) {
    fail(`Command failed: ${command.join(" ")}`)
  }
}

function createApp(definition: TemplateManifest, bootstrap: boolean) {
  const source = resolve(templatesDirectory, definition.id)
  const destination = resolve(repositoryRoot, "apps", definition.destination)
  if (existsSync(destination)) {
    fail(`Refusing to overwrite ${relative(repositoryRoot, destination)}.`)
  }

  mkdirSync(dirname(destination), { recursive: true })
  cpSync(source, destination, {
    filter: shouldCopy,
    recursive: true,
  })
  rewritePackage(destination, definition)
  applyReplacements(destination, definition.replacements)

  if (!bootstrap) return
  if (definition.environmentExample !== undefined) {
    const example = resolve(destination, definition.environmentExample)
    const local = resolve(destination, ".env.local")
    if (!existsSync(local)) copyFileSync(example, local)
  }
  run(["pnpm", "install"])
  for (const command of definition.bootstrapCommands) run(command)
}

function usage(): string {
  return [
    "Usage: pnpm create:app -- <template> [--no-bootstrap] [--dry-run]",
    "       pnpm create:app -- --list",
  ].join("\n")
}

function main() {
  const args = process.argv.slice(2)
  if (args.includes("--list")) {
    process.stdout.write(`${templateIds().join("\n")}\n`)
    return
  }
  const templateId = args.find((arg) => !arg.startsWith("--"))
  if (templateId === undefined) fail(usage())
  const definition = manifest(templateId)
  const destination = `apps/${definition.destination}`
  if (args.includes("--dry-run")) {
    process.stdout.write(
      `Would create ${destination} from templates/${definition.id}.\n`
    )
    return
  }
  createApp(definition, !args.includes("--no-bootstrap"))
  process.stdout.write(`Created ${destination}.\n`)
}

try {
  main()
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
}
