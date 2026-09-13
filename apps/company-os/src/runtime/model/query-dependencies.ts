import {
  modelObjectLinkTraversals,
  modelTypeAccepts,
  type ModelCatalog,
} from "#/runtime/model/definition/model.ts"
import type { ObjectType } from "#/runtime/model/definition/object.ts"
import { resolveQueryField } from "#/runtime/model/query-fields.ts"

type QueryType = Parameters<typeof resolveQueryField>[1]

/** Types whose records can change a read's membership, order, or expanded values. */
export function queryDependencies(
  model: ModelCatalog,
  roots: ReadonlyArray<ObjectType>,
  input: unknown
): string[] {
  const types = new Set<string>()
  const addType = (id: string) => {
    for (const object of Object.values(model.objects))
      if (modelTypeAccepts(model, object.id, id) && !types.has(object.id)) {
        types.add(object.id)
        for (const path of object.display.titleFields ?? [])
          for (const traversal of resolveQueryField(model, object, path)
            .traversals)
            addType(traversal.to.typeId)
      }
  }
  for (const root of roots) addType(root.id)
  const field = (
    type: QueryType,
    path: string,
    aggregate?: "count" | "min" | "max"
  ) => {
    const resolved = resolveQueryField(model, type, path, aggregate)
    for (const traversal of resolved.traversals) addType(traversal.to.typeId)
    return resolved.target
  }
  const filter = (type: QueryType, value: unknown): void => {
    if (!value || typeof value !== "object") return
    if ("field" in value && typeof value.field === "string")
      field(type, value.field)
    if ("link" in value && typeof value.link === "string") {
      const target = field(type, value.link, "count")
      for (const key of ["some", "none", "every"])
        if (key in value) filter(target, Reflect.get(value, key))
    }
    for (const key of ["and", "or"]) {
      const children: unknown = Reflect.get(value, key)
      if (Array.isArray(children))
        for (const child of children) filter(type, child)
    }
    if ("not" in value) filter(type, value.not)
  }
  if (!input || typeof input !== "object") return [...types]
  try {
    for (const root of roots) {
      if ("filter" in input) filter(root, input.filter)
      if ("sort" in input && Array.isArray(input.sort)) {
        for (const sort of input.sort) {
          if (
            sort &&
            typeof sort === "object" &&
            "field" in sort &&
            typeof sort.field === "string"
          )
            field(root, sort.field, sort.aggregate)
        }
      }
      if ("expand" in input) {
        const expand = input.expand
        for (const { traversal } of modelObjectLinkTraversals(model, root))
          if (
            expand === true ||
            (expand &&
              typeof expand === "object" &&
              Reflect.get(expand, traversal.key) === true)
          )
            addType(traversal.to.typeId)
      }
    }
  } catch {
    // Invalid expressions still reach the server's typed validation error.
    return Object.keys(model.objects)
  }
  return [...types]
}
