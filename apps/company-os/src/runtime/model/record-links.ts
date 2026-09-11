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
  const id = record.links[key]?.ids[0]
  return id === undefined ? null : RecordId(target.id)(id)
}
