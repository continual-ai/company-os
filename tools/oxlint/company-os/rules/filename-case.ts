import { defineRule } from "@oxlint/plugins"

const ALLOWED_FRAMEWORK_FILENAMES = new Set(["$", "__root"])
const ALLOWED_SOURCE_SUFFIXES = new Set(["config", "functions", "gen", "test"])
const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const TANSTACK_DYNAMIC_ROUTE =
  /[\\/]src[\\/]routes[\\/](?:.*[\\/])?\$[a-z][A-Za-z0-9]*\.[cm]?[jt]sx?$/
const NUMBERED_MIGRATION =
  /[\\/]migrations[\\/]\d+_[a-z0-9]+(?:-[a-z0-9]+)*\.[cm]?tsx?$/
const RESERVED_START_ENTRYPOINT =
  /[\\/](?:apps|templates)[\\/][^\\/]+[\\/]src[\\/](?:client|server|start)\.[cm]?[jt]sx?$/

function sourceName(filename: string): string {
  const basename = filename.split(/[\\/]/).at(-1) ?? filename
  const withoutExtension = basename.replace(/\.[cm]?[jt]sx?$/, "")
  const parts = withoutExtension.split(".")
  while (parts.length > 1 && ALLOWED_SOURCE_SUFFIXES.has(parts.at(-1) ?? "")) {
    parts.pop()
  }
  return parts.join(".")
}

/** Require safe, searchable, cross-platform source filenames. */
export const filenameCaseRule = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Require kebab-case source filenames and protect reserved framework entrypoints.",
    },
    messages: {
      invalidFilename:
        'Rename "{{filename}}" to kebab-case (for example, "email-delivery-port.ts").',
      reservedStartEntrypoint:
        '"{{filename}}" is a reserved TanStack Start entrypoint. Use a purpose-named module unless this file intentionally boots the application.',
    },
  },
  createOnce(context) {
    return {
      Program(node) {
        if (RESERVED_START_ENTRYPOINT.test(context.filename)) {
          context.report({
            node,
            messageId: "reservedStartEntrypoint",
            data: {
              filename:
                context.filename.split(/[\\/]/).at(-1) ?? context.filename,
            },
          })
          return
        }

        const name = sourceName(context.filename)
        if (
          ALLOWED_FRAMEWORK_FILENAMES.has(name) ||
          KEBAB_CASE.test(name) ||
          TANSTACK_DYNAMIC_ROUTE.test(context.filename) ||
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
