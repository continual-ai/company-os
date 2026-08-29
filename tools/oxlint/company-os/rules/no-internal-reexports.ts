import { defineRule } from "@oxlint/plugins"

function isPublicPackageEntrypoint(filename: string): boolean {
  const normalizedFilename = filename.replaceAll("\\", "/")
  return /(?:^|\/)packages\/[^/]+\/src\/index\.[cm]?[jt]sx?$/.test(
    normalizedFilename
  )
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
      internalReexport:
        "Do not re-export through an internal module. Import the symbol from its defining module, or expose it through the package's public src/index.ts entrypoint.",
      wildcardReexport:
        "Do not use wildcard re-exports. Expose a deliberate list of named package exports.",
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
      },
      ExportAllDeclaration(node) {
        context.report({ node: node.source, messageId: "wildcardReexport" })
      },
    }
  },
})
