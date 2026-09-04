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
  readonly environmentExample?: string | undefined
  readonly id: string
  readonly scripts: Readonly<Record<string, string>>
}

const nonEmptyStringSchema = Schema.String.check(Schema.isNonEmpty())
const templateManifestSchema = Schema.Struct({
  bootstrapCommands: Schema.Array(
    Schema.Array(nonEmptyStringSchema).check(Schema.isMinLength(1))
  ),
  environmentExample: Schema.optionalKey(nonEmptyStringSchema),
  id: nonEmptyStringSchema,
  scripts: Schema.Record(nonEmptyStringSchema, nonEmptyStringSchema),
})
const dependencyMapSchema = Schema.Record(
  nonEmptyStringSchema,
  nonEmptyStringSchema
)
const continualAppConfigSchema = Schema.Struct({
  database: Schema.optionalKey(Schema.Boolean),
  description: Schema.optionalKey(nonEmptyStringSchema),
  key: nonEmptyStringSchema,
  name: nonEmptyStringSchema,
  output: Schema.optionalKey(nonEmptyStringSchema),
})
const packageJsonSchema = Schema.Struct({
  continual: continualAppConfigSchema,
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
  ".continual",
  ".output",
  ".tanstack",
  ".turbo",
  ".wrangler",
  "dist",
  "node_modules",
])
const ignoredFileNames = new Set([
  ".env",
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
  if (decoded.id !== templateId) {
    fail(
      `Template manifest id '${decoded.id}' must match directory '${templateId}'.`
    )
  }
  return {
    ...decoded,
    bootstrapCommands: decoded.bootstrapCommands.map((command) => {
      const [executable, ...args] = command
      if (executable === undefined) fail("Bootstrap command cannot be empty.")
      return [executable, ...args] as const
    }),
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

const APP_NAME_PATTERN = /^[a-z](?:[a-z0-9-]*[a-z0-9])?$/

function assertAppName(name: string): string {
  if (!APP_NAME_PATTERN.test(name)) {
    fail(
      `App name '${name}' must be kebab-case: lowercase letters, digits, and single dashes.`
    )
  }
  if (name === "company-os") {
    fail("The central app already exists; 'company-os' is reserved.")
  }
  return name
}

function appDisplayName(name: string): string {
  return name
    .split("-")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ")
}

// The manifest is written in terms of the template id (turbo filters, script
// arguments), so every occurrence is retargeted to the created app's name.
function retarget(value: string, definition: TemplateManifest, name: string) {
  return value.replaceAll(definition.id, name)
}

function rewritePackage(
  destination: string,
  definition: TemplateManifest,
  name: string
) {
  const path = resolve(destination, "package.json")
  const packageJson = Schema.decodeUnknownSync(packageJsonSchema)(
    JSON.parse(readFileSync(path, "utf8"))
  )
  writeFileSync(
    path,
    `${JSON.stringify(
      {
        ...packageJson,
        continual: {
          ...packageJson.continual,
          key: name,
          name: appDisplayName(name),
        },
        name,
        scripts: Object.fromEntries(
          Object.entries(definition.scripts).map(([key, script]) => [
            key,
            retarget(script, definition, name),
          ])
        ),
      },
      null,
      2
    )}\n`
  )
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

function addApp(
  definition: TemplateManifest,
  name: string,
  bootstrap: boolean
) {
  const source = resolve(templatesDirectory, definition.id)
  const destination = resolve(repositoryRoot, "apps", name)
  if (existsSync(destination)) {
    fail(`Refusing to overwrite ${relative(repositoryRoot, destination)}.`)
  }

  mkdirSync(dirname(destination), { recursive: true })
  cpSync(source, destination, {
    filter: shouldCopy,
    recursive: true,
  })
  rewritePackage(destination, definition, name)

  if (!bootstrap) return
  if (definition.environmentExample !== undefined) {
    const example = resolve(destination, definition.environmentExample)
    const environment = resolve(destination, ".env")
    if (!existsSync(environment)) copyFileSync(example, environment)
  }
  run(["pnpm", "install"])
  for (const command of definition.bootstrapCommands) {
    const [executable, ...commandArgs] = command
    run([
      retarget(executable, definition, name),
      ...commandArgs.map((arg) => retarget(arg, definition, name)),
    ])
  }
}

function usage(): string {
  return [
    "Usage: pnpm app:create <template> <app-name> [--dry-run] [--no-bootstrap]",
    "",
    "The app name becomes the directory under apps/, the package name, and the",
    "permanent app key on any hosting platform.",
    "",
    "Available templates:",
    ...templateIds().map((id) => `  ${id}`),
  ].join("\n")
}

function main() {
  const args = process.argv.slice(2)
  if (args.length === 0 || args.includes("--help")) {
    process.stdout.write(`${usage()}\n`)
    return
  }
  const allowedFlags = new Set(["--dry-run", "--no-bootstrap"])
  const unsupportedFlag = args.find(
    (arg) => arg.startsWith("--") && !allowedFlags.has(arg)
  )
  if (unsupportedFlag !== undefined)
    fail(`Unknown option '${unsupportedFlag}'.`)
  const [templateId, appName, ...extra] = args.filter(
    (arg) => !arg.startsWith("--")
  )
  if (templateId === undefined || appName === undefined || extra.length > 0) {
    fail(usage())
  }
  const definition = manifest(templateId)
  const name = assertAppName(appName)
  const destination = `apps/${name}`
  if (args.includes("--dry-run")) {
    process.stdout.write(
      `Would add ${destination} from templates/${definition.id}.\n`
    )
    return
  }
  addApp(definition, name, !args.includes("--no-bootstrap"))
  process.stdout.write(
    `Added ${destination}.\nRun: pnpm turbo run dev --filter=${name}\n`
  )
}

try {
  main()
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
}
