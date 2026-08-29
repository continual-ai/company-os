import { defineRule } from "@oxlint/plugins"
import type { ESTree, Scope, SourceCode, Variable } from "@oxlint/plugins"

function resolveVariable(
  sourceCode: SourceCode,
  identifier: ESTree.IdentifierReference
): Variable | null {
  let scope: Scope | null = sourceCode.getScope(identifier)
  while (scope !== null) {
    const variable = scope.set.get(identifier.name)
    if (variable !== undefined) return variable
    scope = scope.upper
  }
  return null
}

function isDrizzleSqlBinding(
  sourceCode: SourceCode,
  identifier: ESTree.IdentifierReference
): boolean {
  const variable = resolveVariable(sourceCode, identifier)
  return (
    variable?.defs.some(
      (definition) =>
        definition.type === "ImportBinding" &&
        definition.node.type === "ImportSpecifier" &&
        definition.parent?.type === "ImportDeclaration" &&
        definition.parent.source.value === "drizzle-orm" &&
        (definition.node.imported.type === "Identifier"
          ? definition.node.imported.name
          : definition.node.imported.value) === "sql"
    ) ?? false
  )
}

/** Keep dynamic values on parameterized Drizzle or Effect SQL paths. */
export const noUnsafeSqlRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Forbid Drizzle raw SQL escape hatches while allowing parameterized SQL templates.",
    },
    messages: {
      unsafeSql:
        "Do not use Drizzle sql.{{method}}(). Use typed expressions or parameterized SQL templates; put reviewed DDL in a migration.sql file.",
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (
          node.callee.type !== "MemberExpression" ||
          node.callee.computed ||
          node.callee.object.type !== "Identifier" ||
          !isDrizzleSqlBinding(context.sourceCode, node.callee.object) ||
          node.callee.property.type !== "Identifier" ||
          (node.callee.property.name !== "raw" &&
            node.callee.property.name !== "unsafe")
        )
          return

        context.report({
          node,
          messageId: "unsafeSql",
          data: { method: node.callee.property.name },
        })
      },
    }
  },
})
