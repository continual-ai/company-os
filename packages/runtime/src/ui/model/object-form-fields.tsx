import { useTypedAppFormContext } from "#/ui/forms/app-form.ts"
import type { FormValue } from "#/ui/model/form-value.ts"
import type { ResolvedObjectUi } from "#/ui/model/module-ui.tsx"
import {
  parentName,
  type ClientRecord,
  type ModelObject,
} from "#/ui/model/object-client.ts"
import { ObjectFormPropertyField } from "#/ui/model/object-form-property-field.tsx"
import { ObjectFormSection } from "#/ui/model/object-form-section.tsx"
import {
  objectFormLinks,
  objectFormProperties,
  stringValue,
  type ObjectFormMode,
  type ObjectFormValues,
} from "#/ui/model/object-form.ts"
import { ObjectLinkEditField } from "#/ui/model/object-link-edit-field.tsx"
import { ObjectReferenceMultiSelect } from "#/ui/model/object-reference-multi-select.tsx"
import { ObjectReferenceSelect } from "#/ui/model/object-reference-select.tsx"
import { useModelRuntime } from "#/ui/model/runtime-context.tsx"

const emptyObjectFormValues: ObjectFormValues = {}
const objectFormContextOptions = { defaultValues: emptyObjectFormValues }
function stringArrayValue(value: FormValue): ReadonlyArray<string> {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : []
}

export function ObjectFormFields({
  mode,
  fields,
  object,
  record,
  referenceLabels,
  fieldEditors,
}: {
  readonly fields?: ReadonlyArray<string> | undefined
  readonly fieldEditors?: ResolvedObjectUi["fieldEditors"]
  readonly mode: ObjectFormMode
  readonly object: ModelObject
  readonly record?: ClientRecord | undefined
  readonly referenceLabels: ReadonlyMap<string, string>
}) {
  const runtime = useModelRuntime()

  const form = useTypedAppFormContext(objectFormContextOptions)
  const links =
    fields === undefined ? objectFormLinks(runtime, object, mode) : []
  const properties = objectFormProperties(object, mode)
    .filter(({ id }) => fields === undefined || fields.includes(id))
    .sort((a, b) =>
      a.id === object.display.title ? -1 : b.id === object.display.title ? 1 : 0
    )

  const details = properties.filter(({ schema }) => schema.kind !== "recordId")
  const references = properties.filter(
    ({ schema }) => schema.kind === "recordId"
  )
  const hasParent = mode === "create" && object.parent.kind !== "root"
  const hasRelated = hasParent || references.length > 0 || links.length > 0
  const renderProperty = (entry: (typeof properties)[number]) => (
    <ObjectFormPropertyField
      key={entry.id}
      entry={entry}
      record={record}
      object={object}
      mode={mode}
      referenceLabels={referenceLabels}
      fieldEditors={fieldEditors}
    />
  )
  return (
    <>
      {details.length > 0 && (
        <ObjectFormSection
          title={hasRelated && details.length > 1 ? "Details" : undefined}
        >
          {details.map(renderProperty)}
        </ObjectFormSection>
      )}
      {hasRelated && (
        <ObjectFormSection
          title={fields === undefined ? "Related records" : undefined}
        >
          {mode === "create" && object.parent.kind !== "root" ? (
            <form.AppField name="parent">
              {(field) => (
                <field.FormField
                  id={`${object.id}-parent`}
                  label={parentName(runtime, object)}
                >
                  {({
                    ariaDescribedBy,
                    invalid,
                    onBlur,
                    onValueChange,
                    value,
                  }) => (
                    <ObjectReferenceSelect
                      ariaDescribedBy={ariaDescribedBy}
                      id={`${object.id}-parent`}
                      invalid={invalid}
                      required
                      name="parent"
                      typeId={object.parent.typeId}
                      value={stringValue(value)}
                      initialLabel={referenceLabels.get(stringValue(value))}
                      onBlur={onBlur}
                      onValueChange={onValueChange}
                    />
                  )}
                </field.FormField>
              )}
            </form.AppField>
          ) : null}
          {references.map(renderProperty)}
          {links.map((linkTraversal) => {
            const { target, traversal } = linkTraversal
            const fieldId = `${object.id}-${mode}-link-${traversal.key}`
            const name = `links.${traversal.key}`
            return (
              <form.AppField key={traversal.key} name={name}>
                {(field) => (
                  <field.FormField
                    id={fieldId}
                    label={traversal.label}
                    description={traversal.description}
                  >
                    {({
                      ariaDescribedBy,
                      invalid,
                      onBlur,
                      onValueChange,
                      value,
                    }) =>
                      mode === "edit" && record !== undefined ? (
                        <ObjectLinkEditField
                          ariaDescribedBy={ariaDescribedBy}
                          id={fieldId}
                          invalid={invalid}
                          name={name}
                          object={object}
                          record={record}
                          traversal={linkTraversal}
                          value={value}
                          onBlur={onBlur}
                          onValueChange={onValueChange}
                        />
                      ) : traversal.cardinality === "many" ? (
                        <ObjectReferenceMultiSelect
                          referenceLabels={referenceLabels}
                          id={fieldId}
                          name={name}
                          value={stringArrayValue(value)}
                          invalid={invalid}
                          ariaDescribedBy={ariaDescribedBy}
                          typeId={target.from.typeId}
                          onBlur={onBlur}
                          onValueChange={onValueChange}
                        />
                      ) : (
                        <ObjectReferenceSelect
                          ariaDescribedBy={ariaDescribedBy}
                          id={fieldId}
                          invalid={invalid}
                          name={name}
                          required={traversal.cardinality === "one"}
                          typeId={target.from.typeId}
                          value={stringValue(value)}
                          initialLabel={referenceLabels.get(stringValue(value))}
                          onBlur={onBlur}
                          onValueChange={onValueChange}
                        />
                      )
                    }
                  </field.FormField>
                )}
              </form.AppField>
            )
          })}
        </ObjectFormSection>
      )}
    </>
  )
}
