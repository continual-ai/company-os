import { Button } from "@company/ui/button"
import { PencilIcon } from "lucide-react"

import type { ObjectType } from "#/runtime/model/definition/object.ts"
import {
  objectFields,
  orderObjectFields,
} from "#/runtime/model/object-fields.ts"
import { isSupportedFormSchema } from "#/runtime/ui/forms/schema-form-values.ts"
import type {
  ClientRecord,
  ObjectRecordPresentation,
} from "#/runtime/ui/model/object-client.ts"
import { ObjectFieldValue } from "#/runtime/ui/model/object-field.tsx"
import { objectFormProperties } from "#/runtime/ui/model/object-form.ts"
import { objectTablePropertySchema } from "#/runtime/ui/model/object-table/object-table-cell-types.ts"
import { useModelRuntime } from "#/runtime/ui/model/runtime-context.tsx"

export function ObjectPropertiesCard({
  object,
  record,
  references,
  fields,
  onEdit,
}: {
  readonly fields?: ReadonlyArray<string> | undefined
  readonly onEdit?: ((field: string) => void) | undefined
  readonly object: ObjectType
  readonly record: ClientRecord
  readonly references: ReadonlyMap<string, ObjectRecordPresentation>
}) {
  const runtime = useModelRuntime()
  const editableProperties = new Set(
    objectFormProperties(object, "edit")
      .filter(({ schema }) => isSupportedFormSchema(schema))
      .map(({ id }) => id)
  )
  const displayed = orderObjectFields(
    objectFields(object, runtime.model),
    fields
  ).filter((field) =>
    fields
      ? fields.includes(field.id)
      : field.kind === "property" ||
        (field.kind === "link" && field.traversal.traversal.max === 1)
  )
  return (
    <section className="min-w-0">
      <dl className="-mx-2">
        {displayed.map((field) => {
          const { id, property } = field
          const schema = objectTablePropertySchema(property)
          const grouped =
            schema.kind === "struct" ||
            (schema.kind === "union" &&
              schema.members.some(
                (member) => objectTablePropertySchema(member).kind === "struct"
              ))
          const editable =
            field.kind === "link"
              ? field.traversal.writable
              : field.kind === "property" && editableProperties.has(id)
          const directEdit =
            onEdit &&
            editable &&
            field.kind === "property" &&
            (["boolean", "decimal", "enum", "number"].includes(schema.kind) ||
              (schema.kind === "string" && schema.format === undefined))
          const value = (
            <ObjectFieldValue
              field={field}
              record={record}
              resolveRecord={(recordId) => references.get(recordId)}
            />
          )
          const label = property.label ?? id
          return (
            <div
              key={id}
              data-record-field={id}
              className={
                grouped
                  ? "group relative space-y-2 px-2 py-3"
                  : "group relative grid min-h-8 grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-x-2 rounded-md px-2 py-1.5 hover:bg-muted/40"
              }
            >
              <dt
                className={
                  grouped
                    ? "pr-6 text-sm font-medium"
                    : "text-xs text-muted-foreground"
                }
              >
                {label}
              </dt>
              <dd
                className={
                  grouped
                    ? "min-w-0"
                    : "min-w-0 pr-5 text-xs wrap-break-word whitespace-pre-wrap [&_a]:max-w-full [&_a]:truncate"
                }
              >
                {directEdit ? (
                  <button
                    type="button"
                    className="w-full cursor-pointer rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Edit ${label}`}
                    onClick={() => onEdit(id)}
                  >
                    {value}
                  </button>
                ) : (
                  value
                )}
              </dd>
              {onEdit && editable && !directEdit && (
                <Button
                  size="icon-xs"
                  variant="ghost"
                  className="absolute top-1 right-0 bg-background opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
                  aria-label={`Edit ${label}`}
                  onClick={() => onEdit(id)}
                >
                  <PencilIcon />
                </Button>
              )}
            </div>
          )
        })}
      </dl>
    </section>
  )
}
