import type { ObjectType } from "#/runtime/model/definition/object.ts"
import type { AnySchema } from "#/runtime/model/definition/schema.ts"

/** A versioned business fact. Publishing it never invokes consumers inside the write transaction. */
export function defineEvent<
  const TType extends string,
  const TObject extends ObjectType,
  const TData extends AnySchema,
  const TVersion extends number,
>(definition: {
  readonly type: TType
  readonly version: TVersion
  readonly subject: TObject
  readonly data: TData
}) {
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
