import type {
  BaseRecord,
  ObjectType,
} from "#/runtime/model/definition/object.ts"
import { RecordId } from "#/runtime/model/definition/schema.ts"

/** Hydration is separate; single-item UIs and business rules read the same link preview. */
export function linkedId<O extends ObjectType>(
  record: Pick<BaseRecord, "links">,
  key: string,
  target: O
): RecordId<O["id"]> | null {
  const id = record.links[key]
  if (id === null || id === undefined) return null
  if (typeof id === "object" && "id" in id) return RecordId(target.id)(id.id)
  if (typeof id !== "string") throw new Error(`Link '${key}' is plural.`)
  return RecordId(target.id)(id)
}

export function linkPreview(
  value:
    | string
    | { readonly id: string }
    | {
        readonly items: ReadonlyArray<{ readonly id: string }>
        readonly totalSize: number
      }
    | null
    | { readonly ids: ReadonlyArray<string>; readonly totalSize: number }
    | undefined
): {
  readonly ids: ReadonlyArray<string>
  readonly totalSize: number
} {
  if (value === null || value === undefined) return { ids: [], totalSize: 0 }
  if (typeof value === "string") return { ids: [value], totalSize: 1 }
  if ("id" in value) return { ids: [value.id], totalSize: 1 }
  if ("items" in value)
    return {
      ids: value.items.map((item) => item.id),
      totalSize: value.totalSize,
    }
  return value
}
