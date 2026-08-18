import { defineRule } from "@oxlint/plugins"
import type { ESTree } from "@oxlint/plugins"

const APPLICATION_PACKAGE_NAMES = [
  "client-portal",
  "company-os",
  "marketing-site",
] as const

function packageNameForFile(filename: string): string | null {
  const normalizedFilename = filename.replaceAll("\\", "/")
  const libraryMatch = normalizedFilename.match(
    /(?:^|\/)packages\/([^/]+)\/([^/]+)(?:\/|$)/
  )
  if (libraryMatch) return `@${libraryMatch[1]}/${libraryMatch[2]}`

  const applicationMatch = normalizedFilename.match(
    /(?:^|\/)apps\/([^/]+)(?:\/|$)/
  )
  return applicationMatch ? `app:${applicationMatch[1]}` : null
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
    packageName.startsWith("@continual/") &&
    APPLICATION_PACKAGE_NAMES.some((appName) => isPackage(specifier, appName))
  ) {
    return "Reusable @continual packages cannot depend on company applications."
  }

  if (
    packageName === "@acme/contract" &&
    ((specifier.startsWith("@acme/") &&
      !isPackage(specifier, "@acme/contract")) ||
      (specifier.startsWith("@continual/") &&
        !isPackage(specifier, "@continual/runtime")))
  ) {
    return "@acme/contract may depend only on @continual/runtime; it cannot depend on UI or implementations."
  }

  if (
    packageName === "@acme/ui" &&
    (isAnyPackage(specifier, ["@acme/contract", "@continual/runtime"]) ||
      APPLICATION_PACKAGE_NAMES.some((appName) =>
        isPackage(specifier, appName)
      ))
  ) {
    return "@acme/ui owns presentation primitives and cannot depend on business definitions, execution, or applications."
  }

  if (
    packageName.startsWith("app:") &&
    APPLICATION_PACKAGE_NAMES.some((appName) => isPackage(specifier, appName))
  ) {
    return "Applications are independent deployables and cannot import one another."
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
