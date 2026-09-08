import { Schema } from "effect"

import { toEffectSchema } from "#/contract/schema.ts"
import type { AnySchema } from "#/model/index.ts"

/** Derives event visibility dependencies from decoded semantic references, including nested payloads. */
export function eventReferences(
  schema: AnySchema,
  value: unknown
): ReadonlyArray<{ id: string; typeId: string }> {
  if (value === null || value === undefined) return []
  switch (schema.kind) {
    case "recordId":
      return typeof value === "string"
        ? [{ id: value, typeId: schema.typeId }]
        : []
    case "image":
    case "file":
    case "media":
      return typeof value === "object" &&
        "assetId" in value &&
        typeof value.assetId === "string"
        ? [{ id: value.assetId, typeId: "asset" }]
        : []
    case "optional":
      return eventReferences(schema.value, value)
    case "array":
      return Array.isArray(value)
        ? value.flatMap((item) => eventReferences(schema.items, item))
        : []
    case "map":
      return typeof value === "object"
        ? Object.values(value).flatMap((item) =>
            eventReferences(schema.values, item)
          )
        : []
    case "struct":
      return typeof value === "object"
        ? Object.entries(schema.properties).flatMap(([key, field]) =>
            eventReferences(field, Reflect.get(value, key))
          )
        : []
    case "union": {
      const member = schema.members.find((candidate) =>
        Schema.is(toEffectSchema(candidate))(value)
      )
      return member === undefined ? [] : eventReferences(member, value)
    }
    default:
      return []
  }
}
