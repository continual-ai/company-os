import { defineRule } from "@oxlint/plugins"
import type { ESTree } from "@oxlint/plugins"

const APPLICATION_PACKAGE_NAMES = [
  "@company-template/client-portal",
  "@company-template/company-os",
  "@company-template/marketing-site",
  "client-portal",
  "company-os",
  "marketing-site",
] as const

const COMPANY_PACKAGE_NAMES = ["model", "postgres", "runtime", "ui"] as const

function packageNameForFile(filename: string): string | null {
  const normalizedFilename = filename.replaceAll("\\", "/")
  const libraryMatch = normalizedFilename.match(
    /(?:^|\/)packages\/([^/]+)(?:\/|$)/
  )
  if (
    libraryMatch &&
    COMPANY_PACKAGE_NAMES.some((name) => name === libraryMatch[1])
  ) {
    return `@company/${libraryMatch[1]}`
  }

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
  return normalizedFilename.includes("/src/server/")
}

function forbiddenReason(
  filename: string,
  packageName: string,
  specifier: string
): string | null {
  if (
    packageName === "@company/runtime" &&
    specifier.startsWith("@company/") &&
    !isPackage(specifier, "@company/runtime")
  ) {
    return "@company/runtime is the portable foundation and cannot depend on model, storage, or UI packages."
  }

  if (
    packageName === "@company/postgres" &&
    specifier.startsWith("@company/") &&
    !isPackage(specifier, "@company/postgres") &&
    !isPackage(specifier, "@company/runtime")
  ) {
    return "@company/postgres may depend only on @company/runtime; model and application policy remain outside the adapter."
  }

  if (
    packageName === "@company/model" &&
    specifier.startsWith("@company/") &&
    !isPackage(specifier, "@company/model") &&
    !isPackage(specifier, "@company/runtime")
  ) {
    return "@company/model may depend only on @company/runtime; it cannot depend on UI or implementations."
  }

  if (
    packageName === "@company/ui" &&
    specifier.startsWith("@company/") &&
    !isPackage(specifier, "@company/ui")
  ) {
    return "@company/ui owns presentation primitives and cannot depend on business definitions, execution, or applications."
  }

  if (
    packageName.startsWith("@company/") &&
    APPLICATION_PACKAGE_NAMES.some((appName) => isPackage(specifier, appName))
  ) {
    return "Source-owned packages cannot depend on deployable applications."
  }

  if (
    packageName.startsWith("app:") &&
    isPackage(specifier, "@company/postgres") &&
    !isServerSourceFile(filename)
  ) {
    return "@company/postgres is server-only and must be imported behind an app server module."
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
      const reason = forbiddenReason(context.filename, packageName, specifier)
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
