import { defineRule } from "@oxlint/plugins"
import type { ESTree } from "@oxlint/plugins"

const PUBLIC_PACKAGE_ENTRYPOINTS = [
  "packages/company/model/src/index.ts",
  "packages/company/postgres/src/index.ts",
  "packages/company/runtime/src/index.ts",
] as const

function isPublicPackageEntrypoint(filename: string): boolean {
  const normalizedFilename = filename.replaceAll("\\", "/")
  return PUBLIC_PACKAGE_ENTRYPOINTS.some(
    (entrypoint) =>
      normalizedFilename === entrypoint ||
      normalizedFilename.endsWith(`/${entrypoint}`)
  )
}

function exportedName(specifier: ESTree.ExportSpecifier): string {
  return specifier.exported.type === "Identifier"
    ? specifier.exported.name
    : specifier.exported.value
}

/** Keep re-exports at one explicit package API boundary instead of internal barrels. */
export const noInternalReexportsRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Allow explicit named re-exports only from a package's public source entrypoint.",
    },
    messages: {
      defaultReexport:
        "Do not forward a default export. Give the public API an explicit named export.",
      internalReexport:
        "Do not re-export through an internal module. Import the symbol from its defining module, or expose it through the package's public src/index.ts entrypoint.",
    },
  },
  createOnce(context) {
    return {
      ExportNamedDeclaration(node) {
        if (!node.source) return

        if (!isPublicPackageEntrypoint(context.filename)) {
          context.report({
            node: node.source,
            messageId: "internalReexport",
          })
          return
        }

        if (
          node.specifiers.some(
            (specifier) => exportedName(specifier) === "default"
          )
        ) {
          context.report({
            node: node.source,
            messageId: "defaultReexport",
          })
        }
      },
    }
  },
})
