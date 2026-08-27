/* oxlint-disable anti-slop/no-runtime-typeof */
import type { PropertyDefinition } from "@company/runtime"
import { FieldError } from "@company/ui/components/field"
import { Input } from "@company/ui/components/input"
import { Textarea } from "@company/ui/components/textarea"

import { useTypedAppFormContext } from "@/ui/forms/app-form"
import type { FormValue, FormValueObject } from "@/ui/forms/form-value"

import { parentName, type ModelObject } from "./object-client"
import {
  isSupportedFormSchema,
  objectFormLinks,
  objectFormProperties,
  stringValue,
  type ObjectFormMode,
  type ObjectFormValues,
} from "./object-form"
import { ObjectReferenceMultiSelect } from "./object-reference-multi-select"
import { ObjectReferenceSelect } from "./object-reference-select"

const emptyObjectFormValues: ObjectFormValues = {}
const objectFormContextOptions = { defaultValues: emptyObjectFormValues }

function fieldRequired(
  mode: ObjectFormMode,
  property: PropertyDefinition
): boolean {
  return mode === "create" ? property.requiredOnCreate : !property.nullable
}

function isFormValueObject(value: FormValue): value is FormValueObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function nestedValue(value: FormValue, key: string): string {
  return isFormValueObject(value) ? stringValue(value[key]) : ""
}

function stringArrayValue(value: FormValue): ReadonlyArray<string> {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : []
}

function updateNested(
  value: FormValue,
  key: string,
  next: string
): FormValueObject {
  const current = isFormValueObject(value) ? value : {}
  return { ...current, [key]: next }
}

export function ObjectFormFields({
  mode,
  object,
  referenceLabels,
}: {
  readonly mode: ObjectFormMode
  readonly object: ModelObject
  readonly referenceLabels: ReadonlyMap<string, string>
}) {
  const form = useTypedAppFormContext(objectFormContextOptions)

  return (
    <>
      {mode === "create" && object.parent.kind !== "root" ? (
        <form.AppField name="parent">
          {(field) => (
            <field.FormField
              id={`${object.id}-parent`}
              label={parentName(object)}
            >
              {({ ariaDescribedBy, invalid, onBlur, onValueChange, value }) => (
                <ObjectReferenceSelect
                  ariaDescribedBy={ariaDescribedBy}
                  id={`${object.id}-parent`}
                  invalid={invalid}
                  required
                  name="parent"
                  typeId={object.parent.typeId}
                  value={stringValue(value)}
                  onBlur={onBlur}
                  onValueChange={onValueChange}
                />
              )}
            </field.FormField>
          )}
        </form.AppField>
      ) : null}

      {objectFormProperties(object, mode).map(({ id, property, schema }) => {
        const fieldId = `${object.id}-${mode}-${id}`
        const label = property.label ?? id
        const required = fieldRequired(mode, property)

        if (!isSupportedFormSchema(schema)) {
          return (
            <FieldError key={id}>
              {label} uses the unsupported {schema.kind} form type.
            </FieldError>
          )
        }

        if (schema.kind === "boolean") {
          return (
            <form.AppField key={id} name={id}>
              {(field) => (
                <field.FormField
                  id={fieldId}
                  label={label}
                  orientation="horizontal"
                >
                  {({
                    ariaDescribedBy,
                    invalid,
                    onBlur,
                    onValueChange,
                    value,
                  }) => (
                    <input
                      id={fieldId}
                      name={id}
                      type="checkbox"
                      checked={value === true}
                      aria-invalid={invalid}
                      aria-describedby={ariaDescribedBy}
                      onBlur={onBlur}
                      onChange={(event) =>
                        onValueChange(event.currentTarget.checked)
                      }
                    />
                  )}
                </field.FormField>
              )}
            </form.AppField>
          )
        }

        if (schema.kind === "recordId") {
          return (
            <form.AppField key={id} name={id}>
              {(field) => (
                <field.FormField
                  id={fieldId}
                  label={label}
                  description={property.description}
                >
                  {({
                    ariaDescribedBy,
                    invalid,
                    onBlur,
                    onValueChange,
                    value,
                  }) => {
                    const recordId = stringValue(value)
                    return (
                      <ObjectReferenceSelect
                        ariaDescribedBy={ariaDescribedBy}
                        id={fieldId}
                        invalid={invalid}
                        name={id}
                        required={required}
                        typeId={schema.typeId}
                        value={recordId}
                        initialLabel={referenceLabels.get(recordId)}
                        onBlur={onBlur}
                        onValueChange={onValueChange}
                      />
                    )
                  }}
                </field.FormField>
              )}
            </form.AppField>
          )
        }

        if (schema.kind === "enum") {
          return (
            <form.AppField key={id} name={id}>
              {(field) => (
                <field.FormField
                  id={fieldId}
                  label={label}
                  description={property.description}
                >
                  {({
                    ariaDescribedBy,
                    invalid,
                    onBlur,
                    onValueChange,
                    value,
                  }) => (
                    <select
                      id={fieldId}
                      name={id}
                      required={required}
                      value={stringValue(value)}
                      aria-invalid={invalid}
                      aria-describedby={ariaDescribedBy}
                      onBlur={onBlur}
                      onChange={(event) =>
                        onValueChange(event.currentTarget.value)
                      }
                      className="h-8 border border-input bg-background px-2 text-xs aria-invalid:border-destructive"
                    >
                      {required ? null : <option value="">None</option>}
                      {(
                        schema.options ??
                        schema.values.map((option) => ({
                          label: option,
                          value: option,
                        }))
                      ).map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  )}
                </field.FormField>
              )}
            </form.AppField>
          )
        }

        if (schema.kind === "money") {
          return (
            <form.AppField key={id} name={id}>
              {(field) => (
                <field.FormField
                  id={`${fieldId}-amount`}
                  label={label}
                  description={property.description}
                >
                  {({
                    ariaDescribedBy,
                    invalid,
                    onBlur,
                    onValueChange,
                    value,
                  }) => (
                    <div className="grid grid-cols-[1fr_6rem] gap-2">
                      <Input
                        id={`${fieldId}-amount`}
                        name={`${id}.amount`}
                        inputMode="decimal"
                        required={required}
                        value={nestedValue(value, "amount")}
                        placeholder="0.00"
                        aria-invalid={invalid}
                        aria-describedby={ariaDescribedBy}
                        onBlur={onBlur}
                        onChange={(event) =>
                          onValueChange(
                            updateNested(
                              value,
                              "amount",
                              event.currentTarget.value
                            )
                          )
                        }
                      />
                      <Input
                        aria-label={`${label} currency`}
                        name={`${id}.currency`}
                        maxLength={3}
                        value={nestedValue(value, "currency")}
                        aria-invalid={invalid}
                        aria-describedby={ariaDescribedBy}
                        onBlur={onBlur}
                        onChange={(event) =>
                          onValueChange(
                            updateNested(
                              value,
                              "currency",
                              event.currentTarget.value
                            )
                          )
                        }
                      />
                    </div>
                  )}
                </field.FormField>
              )}
            </form.AppField>
          )
        }

        if (
          schema.kind === "file" ||
          schema.kind === "image" ||
          schema.kind === "media"
        ) {
          return (
            <form.AppField key={id} name={id}>
              {(field) => (
                <field.FormField
                  id={`${fieldId}-asset`}
                  label={label}
                  description={
                    property.description ??
                    "Enter an asset ID. A deployment can replace this with its media picker."
                  }
                >
                  {({
                    ariaDescribedBy,
                    invalid,
                    onBlur,
                    onValueChange,
                    value,
                  }) => (
                    <>
                      <Input
                        id={`${fieldId}-asset`}
                        name={`${id}.assetId`}
                        required={required}
                        value={nestedValue(value, "assetId")}
                        placeholder="Asset ID"
                        aria-invalid={invalid}
                        aria-describedby={ariaDescribedBy}
                        onBlur={onBlur}
                        onChange={(event) =>
                          onValueChange(
                            updateNested(
                              value,
                              "assetId",
                              event.currentTarget.value
                            )
                          )
                        }
                      />
                      {schema.kind === "file" ? null : (
                        <Input
                          name={`${id}.alt`}
                          value={nestedValue(value, "alt")}
                          placeholder="Alternative text"
                          aria-invalid={invalid}
                          aria-describedby={ariaDescribedBy}
                          onBlur={onBlur}
                          onChange={(event) =>
                            onValueChange(
                              updateNested(
                                value,
                                "alt",
                                event.currentTarget.value
                              )
                            )
                          }
                        />
                      )}
                    </>
                  )}
                </field.FormField>
              )}
            </form.AppField>
          )
        }

        if (schema.kind === "array") {
          return (
            <form.AppField key={id} name={id}>
              {(field) => (
                <field.FormField
                  id={fieldId}
                  label={label}
                  description={property.description ?? "One value per line."}
                >
                  {({
                    ariaDescribedBy,
                    invalid,
                    onBlur,
                    onValueChange,
                    value,
                  }) => (
                    <Textarea
                      id={fieldId}
                      name={id}
                      required={required}
                      value={stringValue(value)}
                      aria-invalid={invalid}
                      aria-describedby={ariaDescribedBy}
                      onBlur={onBlur}
                      onChange={(event) =>
                        onValueChange(event.currentTarget.value)
                      }
                    />
                  )}
                </field.FormField>
              )}
            </form.AppField>
          )
        }

        const timestamp =
          schema.kind === "string" && schema.format === "timestamp"
        const longText =
          schema.kind === "string" &&
          (schema.maxLength === undefined || schema.maxLength > 300) &&
          schema.format === undefined
        const inputType =
          schema.kind === "number" || schema.kind === "decimal"
            ? "number"
            : schema.kind === "string" && schema.format === "date"
              ? "date"
              : timestamp
                ? "datetime-local"
                : schema.kind === "string" && schema.format === "email"
                  ? "email"
                  : schema.kind === "string" && schema.format === "phone"
                    ? "tel"
                    : schema.kind === "string" && schema.format === "url"
                      ? "url"
                      : "text"

        return (
          <form.AppField key={id} name={id}>
            {(field) => (
              <field.FormField
                id={fieldId}
                label={label}
                description={property.description}
              >
                {({
                  ariaDescribedBy,
                  invalid,
                  onBlur,
                  onValueChange,
                  value,
                }) =>
                  longText ? (
                    <Textarea
                      id={fieldId}
                      name={id}
                      required={required}
                      value={stringValue(value)}
                      maxLength={
                        schema.kind === "string" ? schema.maxLength : undefined
                      }
                      aria-invalid={invalid}
                      aria-describedby={ariaDescribedBy}
                      onBlur={onBlur}
                      onChange={(event) =>
                        onValueChange(event.currentTarget.value)
                      }
                    />
                  ) : (
                    <Input
                      id={fieldId}
                      name={id}
                      type={inputType}
                      required={required}
                      value={stringValue(value)}
                      max={
                        schema.kind === "number" ? schema.maximum : undefined
                      }
                      min={
                        schema.kind === "number" ? schema.minimum : undefined
                      }
                      step={
                        schema.kind === "number" && schema.integer ? 1 : "any"
                      }
                      maxLength={
                        schema.kind === "string" ? schema.maxLength : undefined
                      }
                      minLength={
                        schema.kind === "string" ? schema.minLength : undefined
                      }
                      aria-invalid={invalid}
                      aria-describedby={ariaDescribedBy}
                      onBlur={onBlur}
                      onChange={(event) =>
                        onValueChange(event.currentTarget.value)
                      }
                    />
                  )
                }
              </field.FormField>
            )}
          </form.AppField>
        )
      })}

      {objectFormLinks(object, mode).map(({ target, traversal }) => {
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
                  traversal.cardinality === "many" ? (
                    <ObjectReferenceMultiSelect
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
    </>
  )
}
