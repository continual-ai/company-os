import { PencilIcon } from "lucide-react"

import { Button } from "#/runtime/ui/components/button.tsx"
import {
  parentName,
  modelObjectProperty,
  tableRecord,
  type ClientRecord,
  type ModelObject,
  type ObjectRecordPresentation,
} from "#/runtime/ui/model/object-client.ts"
import {
  objectFormProperties,
  isSupportedFormSchema,
} from "#/runtime/ui/model/object-form.ts"
import { objectPropertyValue } from "#/runtime/ui/model/object-property-value.tsx"
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
  readonly object: ModelObject
  readonly record: ClientRecord
  readonly references: ReadonlyMap<string, ObjectRecordPresentation>
}) {
  const runtime = useModelRuntime()

  const projected = tableRecord(object, record)
  const editable = new Set(
    objectFormProperties(object, "edit")
      .filter(({ schema }) => isSupportedFormSchema(schema))
      .map(({ id }) => id)
  )
  const available = [
    ...(object.parent.kind === "root"
      ? []
      : [["parent", { label: parentName(runtime, object) }] as const]),
    ...Object.entries(object.properties),
  ]
  const properties =
    fields === undefined
      ? available
      : fields.flatMap((field) => available.filter(([id]) => id === field))

  return (
    <section className="min-w-0">
      <dl>
        {properties.map(([propertyId, property]) => {
          const definition = modelObjectProperty(object, propertyId)
          const schema = definition
            ? objectTablePropertySchema(definition)
            : undefined
          const directEdit =
            onEdit &&
            editable.has(propertyId) &&
            schema &&
            (["boolean", "decimal", "enum", "number"].includes(schema.kind) ||
              (schema.kind === "string" && schema.format === undefined))
          const value = objectPropertyValue(
            runtime,
            object,
            propertyId,
            projected[propertyId],
            references
          )
          return (
            <div
              key={propertyId}
              data-record-field={propertyId}
              className="group relative grid min-h-8 grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-x-2 rounded-md px-2 py-1.5 hover:bg-muted/40"
            >
              <dt className="text-xs text-muted-foreground">
                {property.label ?? propertyId}
              </dt>
              <dd className="min-w-0 pr-3 text-xs wrap-break-word whitespace-pre-wrap [&_a]:max-w-full [&_a]:truncate">
                {directEdit ? (
                  <button
                    type="button"
                    className="w-full cursor-pointer rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Edit ${property.label ?? propertyId}`}
                    onClick={() => onEdit(propertyId)}
                  >
                    {value}
                  </button>
                ) : (
                  value
                )}
              </dd>
              {onEdit && editable.has(propertyId) && !directEdit ? (
                <Button
                  size="icon-xs"
                  variant="ghost"
                  className="absolute top-1 right-0 bg-background opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
                  aria-label={`Edit ${property.label ?? propertyId}`}
                  onClick={() => onEdit(propertyId)}
                >
                  <PencilIcon />
                </Button>
              ) : null}
            </div>
          )
        })}
      </dl>
    </section>
  )
}
