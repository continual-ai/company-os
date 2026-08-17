import { defineRule } from "@oxlint/plugins"
import type { ESTree } from "@oxlint/plugins"

function packageNameForFile(filename: string): string | null {
  const normalizedFilename = filename.replaceAll("\\", "/")
  const libraryMatch = normalizedFilename.match(
    /(?:^|\/)packages\/([^/]+)\/([^/]+)(?:\/|$)/
  )
  if (libraryMatch) return `@${libraryMatch[1]}/${libraryMatch[2]}`

  const applicationMatch = normalizedFilename.match(
    /(?:^|\/)apps\/([^/]+)(?:\/|$)/
  )
  return applicationMatch ? `@acme/${applicationMatch[1]}` : null
}

function isPackage(specifier: string, packageName: string): boolean {
  return specifier === packageName || specifier.startsWith(`${packageName}/`)
}

function isAnyPackage(specifier: string, packageNames: string[]): boolean {
  return packageNames.some((packageName) => isPackage(specifier, packageName))
}

function forbiddenReason(
  packageName: string,
  specifier: string
): string | null {
  if (packageName.startsWith("@continual/") && specifier.startsWith("@acme/")) {
    return "Reusable @continual packages cannot depend on source-owned @acme packages."
  }

  if (
    packageName === "@continual/model" &&
    isAnyPackage(specifier, [
      "@continual/cli",
      "@continual/client",
      "@continual/runtime",
      "@continual/studio",
      "@continual/ui",
    ])
  ) {
    return "@continual/model must remain independent of clients, UI, tooling, and server execution."
  }

  if (
    packageName === "@continual/client" &&
    isAnyPackage(specifier, [
      "@continual/cli",
      "@continual/runtime",
      "@continual/studio",
      "@continual/ui",
    ])
  ) {
    return "@continual/client must remain browser-safe and independent of runtime and presentation packages."
  }

  if (
    packageName === "@continual/runtime" &&
    isAnyPackage(specifier, [
      "@continual/cli",
      "@continual/client",
      "@continual/studio",
      "@continual/ui",
    ])
  ) {
    return "@continual/runtime may depend on the model, but not clients, UI, or developer tooling."
  }

  if (
    packageName === "@continual/ui" &&
    isAnyPackage(specifier, [
      "@continual/cli",
      "@continual/runtime",
      "@continual/studio",
    ])
  ) {
    return "@continual/ui must remain browser-safe and independent of runtime and complete applications."
  }

  if (
    packageName === "@continual/studio" &&
    isPackage(specifier, "@continual/runtime")
  ) {
    return "@continual/studio must inspect deployed runtimes through @continual/client, never through server internals."
  }

  if (
    packageName === "@acme/model" &&
    ((specifier.startsWith("@acme/") && !isPackage(specifier, "@acme/model")) ||
      (specifier.startsWith("@continual/") &&
        !isPackage(specifier, "@continual/model")))
  ) {
    return "@acme/model is a public definition package and may depend only on @continual/model."
  }

  if (
    packageName === "@acme/client" &&
    isAnyPackage(specifier, [
      "@acme/api",
      "@continual/cli",
      "@continual/runtime",
      "@continual/studio",
    ])
  ) {
    return "@acme/client must remain browser-safe and independent of server and developer packages."
  }

  if (
    packageName === "@acme/ui" &&
    isAnyPackage(specifier, [
      "@acme/api",
      "@continual/cli",
      "@continual/runtime",
      "@continual/studio",
    ])
  ) {
    return "@acme/ui must remain browser-safe and independent of server execution and developer applications."
  }

  if (
    packageName === "@acme/api" &&
    isAnyPackage(specifier, [
      "@acme/ui",
      "@continual/cli",
      "@continual/studio",
      "@continual/ui",
    ])
  ) {
    return "The Acme API is headless and cannot embed developer tooling or UI packages."
  }

  if (
    ["@acme/portal", "@acme/website", "@acme/workspace"].includes(
      packageName
    ) &&
    isAnyPackage(specifier, [
      "@acme/api",
      "@continual/cli",
      "@continual/runtime",
      "@continual/studio",
    ])
  ) {
    return "Frontend applications must use @acme/client instead of server or developer packages."
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
      forbiddenImport:
        'Import from "{{specifier}}" is forbidden here. {{reason}}',
    },
  },
  createOnce(context) {
    function checkSpecifier(node: ESTree.Node, specifier: string): void {
      const packageName = packageNameForFile(context.filename)
      if (!packageName) return
      const reason = forbiddenReason(packageName, specifier)
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
