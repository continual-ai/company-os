import type { ModelLinkTraversal } from "#/model/definition/model.ts"
import type { ObjectType } from "#/model/definition/object.ts"

function pascalCase(value: string): string {
  return value
    .replace(/(^|[^a-zA-Z0-9]+)([a-zA-Z0-9])/g, (_match, _prefix, char) =>
      char.toUpperCase()
    )
    .replace(/[^a-zA-Z0-9]/g, "")
}

/** Returns the stable operation identifier shared by generated contracts and handlers. */
export function httpEndpointId(
  operation: string,
  object: ObjectType,
  scope?: "collection" | "object"
): string {
  const target =
    scope === "collection" ||
    operation === "list" ||
    operation === "batchGet" ||
    operation === "batchDelete"
      ? object.collection
      : object.id
  return `${operation}${pascalCase(target)}`
}

/** Stable endpoint identifier for one generated Link traversal operation. */
export function linkHttpEndpointId(
  operation: "link" | "list" | "unlink",
  object: ObjectType,
  traversal: ModelLinkTraversal
): string {
  return `${operation}${pascalCase(object.id)}${pascalCase(traversal.traversal.key)}`
}
