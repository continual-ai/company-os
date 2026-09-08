import type { ObjectType } from "#/definition/object.ts"
import type { AnySchema } from "#/definition/schema.ts"

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
    !Number.isInteger(definition.version) ||
    definition.version < 1
  )
    throw new Error(
      "Events require an object namespace and a positive integer version."
    )
  return definition
}
