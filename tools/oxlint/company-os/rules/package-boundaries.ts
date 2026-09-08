import { readFileSync, readdirSync } from "node:fs"
import { extname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { defineRule } from "@oxlint/plugins"
import type { ESTree } from "@oxlint/plugins"

const REPOSITORY_ROOT = fileURLToPath(new URL("../../../../", import.meta.url))

interface WorkspacePackage {
  readonly directory: string
  readonly kind: "application" | "company"
  readonly name: string
}

function packagesIn(
  parent: "apps" | "packages" | "templates" | "modules",
  kind: WorkspacePackage["kind"]
): ReadonlyArray<WorkspacePackage> {
  const directory = join(REPOSITORY_ROOT, parent)
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      try {
        const manifest: unknown = JSON.parse(
          readFileSync(join(directory, entry.name, "package.json"), "utf8")
        )
        return typeof manifest === "object" &&
          manifest !== null &&
          "name" in manifest &&
          typeof manifest.name === "string"
          ? [
              {
                directory: `${parent}/${entry.name}`,
                kind,
                name: manifest.name,
              },
            ]
          : []
      } catch {
        return []
      }
    })
}

const WORKSPACE_PACKAGES = [
  ...packagesIn("packages", "company"),
  ...packagesIn("modules", "company"),
  ...packagesIn("apps", "application"),
  ...packagesIn("templates", "application"),
]
const APPLICATION_PACKAGE_NAMES = new Set(
  WORKSPACE_PACKAGES.filter(({ kind }) => kind === "application").map(
    ({ name }) => name
  )
)
const COMPANY_PACKAGE_NAMES = new Map(
  WORKSPACE_PACKAGES.filter(({ kind }) => kind === "company").map(
    ({ directory, name }) => [directory, name]
  )
)

function packageNameForFile(filename: string): string | null {
  const normalizedFilename = filename.replaceAll("\\", "/")
  const libraryMatch = normalizedFilename.match(
    /(?:^|\/)((?:packages|modules)\/[^/]+)(?:\/|$)/
  )
  if (libraryMatch)
    return COMPANY_PACKAGE_NAMES.get(libraryMatch[1] ?? "") ?? null

  const applicationMatch = normalizedFilename.match(
    /(?:^|\/)(?:apps|templates)\/([^/]+)(?:\/|$)/
  )
  return applicationMatch ? `app:${applicationMatch[1]}` : null
}

function isPackage(specifier: string, packageName: string): boolean {
  return specifier === packageName || specifier.startsWith(`${packageName}/`)
}

function isServerSourceFile(filename: string): boolean {
  const normalizedFilename = filename.replaceAll("\\", "/")
  return (
    normalizedFilename.includes("/server/") ||
    normalizedFilename.includes("/seeds/") ||
    normalizedFilename.includes("/tools/") ||
    /\/(?:server|[^/]+\.server)\.[cm]?[jt]sx?$/.test(normalizedFilename)
  )
}

function moduleSourcePath(filename: string): string | undefined {
  return filename
    .replaceAll("\\", "/")
    .match(
      /(?:\/modules\/[^/]+\/src\/|\/(?:apps|templates)\/[^/]+\/src\/modules\/[^/]+\/)(.+)$/
    )?.[1]
}

function forbiddenReason(
  filename: string,
  packageName: string,
  specifier: string
): string | null {
  if (packageName === "@company/runtime") {
    if (
      specifier.startsWith("@company/") &&
      !isPackage(specifier, "@company/runtime")
    )
      return "Runtime cannot depend on domain modules or applications."
    const source = filename
      .replaceAll("\\", "/")
      .split("/packages/runtime/src/")[1]
      ?.split("/")[0]
    const target = specifier.startsWith("#/")
      ? specifier.slice(2).split("/")[0]
      : specifier.startsWith("@company/runtime/")
        ? specifier.slice("@company/runtime/".length).split("/")[0]
        : undefined
    if (source === "model" && target && target !== "model")
      return "Portable model definitions cannot import execution, persistence, client, or UI code."
    if (
      (source === "contract" || source === "client" || source === "ui") &&
      (target === "server" || target === "testing")
    )
      return "Browser code cannot import server execution, persistence, or test infrastructure."
    if (
      source === "contract" &&
      target &&
      target !== "model" &&
      target !== "contract"
    )
      return "Contracts can depend only on portable models and other contracts."
    if (source === "server" && target === "ui")
      return "Server execution cannot depend on React presentation."
    if (
      (source === "model" ||
        source === "contract" ||
        source === "client" ||
        source === "ui") &&
      (specifier.startsWith("node:") ||
        specifier === "pg" ||
        specifier.startsWith("@effect/sql"))
    )
      return "Node and PostgreSQL dependencies belong behind the server boundary."
  }

  const moduleSource = moduleSourcePath(filename)
  if (moduleSource && !/\.test\.[jt]sx?$/.test(moduleSource)) {
    const model = moduleSource.startsWith("model/")
    const server = /^(?:server|seeds)\//.test(moduleSource)
    const targetServer =
      /(?:^|\/)(?:server|seeds|testing)(?:\/|$)/.test(specifier) ||
      specifier.startsWith("node:") ||
      specifier.startsWith("@effect/sql") ||
      specifier === "pg"
    const targetUi =
      /(?:^|\/)ui(?:\/|$|\.ts$)/.test(specifier) || specifier.endsWith(".tsx")
    if (
      model &&
      (targetServer ||
        targetUi ||
        /(?:^|\/)client(?:\/|$)/.test(specifier) ||
        isPackage(specifier, "effect") ||
        isPackage(specifier, "react"))
    )
      return "Module model definitions cannot depend on execution or presentation."
    if (!server && targetServer)
      return "Module server dependencies belong in server/ or seeds/."
    if (server && targetUi)
      return "Module server execution cannot depend on presentation."
  }

  if (
    packageName.startsWith("@company/") &&
    [...APPLICATION_PACKAGE_NAMES].some((appName) =>
      isPackage(specifier, appName)
    )
  ) {
    return "Source-owned packages cannot depend on deployable applications."
  }

  if (
    packageName.startsWith("app:") &&
    isPackage(specifier, "@company/runtime/server") &&
    !isServerSourceFile(filename)
  ) {
    return "@company/runtime/server is server-only and must be imported behind an app server module."
  }

  if (
    packageName.startsWith("app:") &&
    specifier !== "company-os/model" &&
    specifier !== "company-os/metadata" &&
    [...APPLICATION_PACKAGE_NAMES].some((appName) =>
      isPackage(specifier, appName)
    )
  ) {
    return "Applications are independent deployables and cannot import one another."
  }

  return null
}

function privateImportReason(specifier: string): string | null {
  if (
    specifier.startsWith("@/") ||
    (specifier.startsWith("#") && !specifier.startsWith("#/"))
  )
    return "Use #/ for private source imports; named private aliases and @/ are not allowed."
  if (specifier.startsWith("."))
    return "Use #/ with an explicit file extension for all private source imports, including siblings."
  if (specifier.startsWith("#/")) {
    const path = specifier.slice(2)
    if (
      path
        .split("/")
        .some((part) => part === "." || part === ".." || part === "") ||
      !extname(path)
    )
      return "Use a direct #/ source path with an explicit file extension."
  }
  return null
}

/** Enforce source-level Company OS package ownership and browser/server boundaries. */
export const packageBoundariesRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Enforce Company OS package ownership and browser/server import direction.",
    },
    messages: {
      moduleLayout:
        "Put module source in model/, server/, ui/, or seeds/. Public surfaces use <surface>/index.ts; omit unused surfaces.",
      forbiddenImport:
        'Import from "{{specifier}}" is forbidden here. {{reason}}',
    },
  },
  createOnce(context) {
    function checkSpecifier(node: ESTree.Node, specifier: string): void {
      const packageName = packageNameForFile(context.filename)
      const reason =
        privateImportReason(specifier) ??
        (packageName
          ? forbiddenReason(context.filename, packageName, specifier)
          : null)
      if (!reason) return

      context.report({
        node,
        messageId: "forbiddenImport",
        data: { reason, specifier },
      })
    }

    function checkSource(source: ESTree.StringLiteral): void {
      checkSpecifier(source, source.value)
    }

    return {
      Program(node) {
        const source = moduleSourcePath(context.filename)
        if (
          source &&
          !/\.test\.[jt]sx?$/.test(source) &&
          !/^(?:model|server|ui|seeds)\//.test(source)
        ) {
          context.report({ node, messageId: "moduleLayout" })
        }
      },
      ExportAllDeclaration(node) {
        checkSource(node.source)
      },
      ExportNamedDeclaration(node) {
        if (node.source) checkSource(node.source)
      },
      ImportDeclaration(node) {
        checkSource(node.source)
      },
      ImportExpression(node) {
        if (node.source.type === "Literal")
          checkSpecifier(node.source, String(node.source.value))
      },
      TSImportType(node) {
        checkSource(node.source)
      },
    }
  },
})
