import { defineRule } from "@oxlint/plugins"

/** Keep dynamic values on parameterized Drizzle or Effect SQL paths. */
export const noUnsafeSqlRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Forbid raw and unsafe SQL escape hatches in application TypeScript.",
    },
    messages: {
      unsafeSql:
        "Do not use sql.{{method}}(). Use typed Drizzle expressions or parameterized Effect SQL; put reviewed DDL in a migration.sql file.",
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (
          node.callee.type !== "MemberExpression" ||
          node.callee.computed ||
          node.callee.object.type !== "Identifier" ||
          node.callee.object.name !== "sql" ||
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
