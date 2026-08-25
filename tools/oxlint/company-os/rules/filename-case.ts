import { defineRule } from "@oxlint/plugins"

const ALLOWED_FRAMEWORK_FILENAMES = new Set(["$", "__root"])
const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const NUMBERED_MIGRATION =
  /[\\/]migrations[\\/]\d+_[a-z0-9]+(?:-[a-z0-9]+)*\.[cm]?tsx?$/

function sourceName(filename: string): string {
  const basename = filename.split(/[\\/]/).at(-1) ?? filename
  return basename.split(".")[0] ?? basename
}

/** Require searchable, cross-platform kebab-case source filenames. */
export const filenameCaseRule = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Require kebab-case JavaScript and TypeScript filenames, with narrow framework exceptions.",
    },
    messages: {
      invalidFilename:
        'Rename "{{filename}}" to kebab-case (for example, "email-delivery-port.ts").',
    },
  },
  createOnce(context) {
    return {
      Program(node) {
        const name = sourceName(context.filename)
        if (
          ALLOWED_FRAMEWORK_FILENAMES.has(name) ||
          KEBAB_CASE.test(name) ||
          NUMBERED_MIGRATION.test(context.filename)
        )
          return

        context.report({
          node,
          messageId: "invalidFilename",
          data: {
            filename:
              context.filename.split(/[\\/]/).at(-1) ?? context.filename,
          },
        })
      },
    }
  },
})
