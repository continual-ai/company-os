import type { ObjectType } from "#/runtime/model/definition/object.ts"
import type { AnySchema } from "#/runtime/model/definition/schema.ts"

/** A declared business fact: its versioned type, the object it concerns, and its payload schema. */
export interface EventType<
  TType extends string = string,
  TVersion extends number = number,
  TObject extends ObjectType = ObjectType,
  TData extends AnySchema = AnySchema,
> {
  readonly type: TType
  readonly version: TVersion
  readonly subject: TObject
  readonly data: TData
}

/** A versioned business fact. Publishing it never invokes consumers inside the write transaction. */
export function defineEvent<
  const TType extends string,
  const TObject extends ObjectType,
  const TData extends AnySchema,
  const TVersion extends number,
>(
  definition: EventType<TType, TVersion, TObject, TData>
): EventType<TType, TVersion, TObject, TData> {
  if (
    !definition.type.startsWith(`${definition.subject.id}.`) ||
    ["created", "updated", "deleted"].some(
      (name) => definition.type === `${definition.subject.id}.${name}`
    ) ||
    !Number.isInteger(definition.version) ||
    definition.version < 1
  )
    throw new Error(
      "Events require an object namespace, a positive integer version, and a name distinct from standard record events."
    )
  return definition
}
