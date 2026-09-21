import { defineRule } from "@oxlint/plugins"

const PUBLIC_ENTRYPOINT =
  /(?:^|\/)apps\/company-os\/src\/(?:runtime\/(?:model\/index|server\/index|server\/storage\/index|ui\/module|access\/model\/index|platform\/(?:model|server|ui)\/index)|modules\/[^/]+\/(?:model|server|ui|seeds)\/index|app\.model)\.ts$/

function isPublicEntrypoint(filename: string): boolean {
  return PUBLIC_ENTRYPOINT.test(filename.replaceAll("\\", "/"))
}

/** Keep re-exports at the deliberate kernel, module-surface, and composition entrypoints instead of internal barrels. */
export const noInternalReexportsRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Allow explicit named re-exports only from a deliberate public entrypoint.",
    },
    messages: {
      internalReexport:
        "Do not re-export through an internal module. Import the defining file directly; named re-exports belong in a deliberate public entrypoint.",
      wildcardReexport:
        "Do not use wildcard re-exports. Expose a deliberate list of named exports.",
    },
  },
  createOnce(context) {
    return {
      ExportNamedDeclaration(node) {
        if (!node.source) return

        if (!isPublicEntrypoint(context.filename)) {
          context.report({
            node: node.source,
            messageId: "internalReexport",
          })
        }
      },
      ExportAllDeclaration(node) {
        context.report({ node: node.source, messageId: "wildcardReexport" })
      },
    }
  },
})
