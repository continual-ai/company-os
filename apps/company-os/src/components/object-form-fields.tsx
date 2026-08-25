/* oxlint-disable anti-slop/no-runtime-typeof */
import { modelMetadata } from "@company/model"
import type { PropertyDefinition } from "@company/runtime"
import { Field, FieldError, FieldLabel } from "@company/ui/components/field"
import { Input } from "@company/ui/components/input"
import { Textarea } from "@company/ui/components/textarea"

import { errorsForField, type FormErrors } from "./form-errors"
import { FormField } from "./form-field"
import {
  parentName,
  type ClientValue,
  type ClientRecord,
  type ModelObject,
} from "./object-client"
import {
  dateTimeLocalValue,
  isSupportedFormSchema,
  objectFormProperties,
  stringValue,
  type ObjectFormMode,
} from "./object-form"
import { ObjectReferenceSelect } from "./object-reference-select"

function fieldRequired(
  mode: ObjectFormMode,
  property: PropertyDefinition
): boolean {
  return mode === "create" ? property.requiredOnCreate : !property.nullable
}

function initialValue(
  property: PropertyDefinition,
  record: ClientRecord | undefined,
  propertyId: string
): ClientValue | undefined {
  if (record !== undefined) return record[propertyId]
  // SAFETY: portable property defaults are JSON-compatible values by schema.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return property.default as ClientValue | undefined
}

export function ObjectFormFields({
  errors,
  mode,
  object,
  record,
  referenceLabels,
}: {
  readonly errors: FormErrors
  readonly mode: ObjectFormMode
  readonly object: ModelObject
  readonly record?: ClientRecord | undefined
  readonly referenceLabels: ReadonlyMap<string, string>
}) {
  return (
    <>
      {mode === "create" && object.parent.kind !== "root" ? (
        <FormField
          errors={errors}
          id={`${object.id}-parent`}
          label={parentName(object)}
          name="parent"
        >
          {({ ariaDescribedBy, invalid }) => (
            <ObjectReferenceSelect
              ariaDescribedBy={ariaDescribedBy}
              id={`${object.id}-parent`}
              invalid={invalid}
              required
              name="parent"
              typeId={object.parent.typeId}
            />
          )}
        </FormField>
      ) : null}

      {objectFormProperties(object, mode).map(({ id, property, schema }) => {
        const fieldId = `${object.id}-${mode}-${id}`
        const label = property.label ?? id
        const required = fieldRequired(mode, property)
        const value = initialValue(property, record, id)

        if (!isSupportedFormSchema(schema)) {
          return (
            <FieldError key={id}>
              {label} uses the unsupported {schema.kind} form type.
            </FieldError>
          )
        }

        if (schema.kind === "boolean") {
          const violations = errorsForField(errors, id)
          const invalid = violations.length > 0
          return (
            <Field key={id} orientation="horizontal" data-invalid={invalid}>
              <input
                id={fieldId}
                name={id}
                type="checkbox"
                value="true"
                defaultChecked={value === true}
                aria-invalid={invalid}
                aria-describedby={invalid ? `${fieldId}-error` : undefined}
              />
              <FieldLabel htmlFor={fieldId}>{label}</FieldLabel>
              <FieldError id={`${fieldId}-error`} errors={violations} />
            </Field>
          )
        }

        if (schema.kind === "recordId") {
          const recordId = stringValue(value)
          return (
            <FormField
              key={id}
              errors={errors}
              id={fieldId}
              label={label}
              name={id}
              description={property.description}
            >
              {({ ariaDescribedBy, invalid }) => (
                <ObjectReferenceSelect
                  ariaDescribedBy={ariaDescribedBy}
                  id={fieldId}
                  invalid={invalid}
                  name={id}
                  required={required}
                  typeId={schema.typeId}
                  value={recordId}
                  initialLabel={referenceLabels.get(recordId)}
                />
              )}
            </FormField>
          )
        }

        if (schema.kind === "enum") {
          return (
            <FormField
              key={id}
              errors={errors}
              id={fieldId}
              label={label}
              name={id}
              description={property.description}
            >
              {({ ariaDescribedBy, invalid }) => (
                <select
                  id={fieldId}
                  name={id}
                  required={required}
                  defaultValue={stringValue(value)}
                  aria-invalid={invalid}
                  aria-describedby={ariaDescribedBy}
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
            </FormField>
          )
        }

        if (schema.kind === "money") {
          const money =
            typeof value === "object" &&
            value !== null &&
            "amount" in value &&
            "currency" in value
              ? value
              : undefined
          return (
            <FormField
              key={id}
              errors={errors}
              id={`${fieldId}-amount`}
              label={label}
              name={id}
              description={property.description}
            >
              {({ ariaDescribedBy, invalid }) => (
                <div className="grid grid-cols-[1fr_6rem] gap-2">
                  <Input
                    id={`${fieldId}-amount`}
                    name={`${id}.amount`}
                    inputMode="decimal"
                    required={required}
                    defaultValue={stringValue(money?.amount)}
                    placeholder="0.00"
                    aria-invalid={invalid}
                    aria-describedby={ariaDescribedBy}
                  />
                  <Input
                    aria-label={`${label} currency`}
                    name={`${id}.currency`}
                    maxLength={3}
                    defaultValue={
                      stringValue(money?.currency) ||
                      modelMetadata.defaultCurrency
                    }
                    aria-invalid={invalid}
                    aria-describedby={ariaDescribedBy}
                  />
                </div>
              )}
            </FormField>
          )
        }

        if (
          schema.kind === "file" ||
          schema.kind === "image" ||
          schema.kind === "media"
        ) {
          const media =
            typeof value === "object" && value !== null && "assetId" in value
              ? value
              : undefined
          return (
            <FormField
              key={id}
              errors={errors}
              id={`${fieldId}-asset`}
              label={label}
              name={id}
              description={
                property.description ??
                "Enter an asset ID. A deployment can replace this with its media picker."
              }
            >
              {({ ariaDescribedBy, invalid }) => (
                <>
                  <Input
                    id={`${fieldId}-asset`}
                    name={`${id}.assetId`}
                    required={required}
                    defaultValue={stringValue(media?.assetId)}
                    placeholder="Asset ID"
                    aria-invalid={invalid}
                    aria-describedby={ariaDescribedBy}
                  />
                  {schema.kind === "file" ? null : (
                    <Input
                      name={`${id}.alt`}
                      defaultValue={
                        media !== undefined && "alt" in media
                          ? stringValue(media.alt)
                          : ""
                      }
                      placeholder="Alternative text"
                      aria-invalid={invalid}
                      aria-describedby={ariaDescribedBy}
                    />
                  )}
                </>
              )}
            </FormField>
          )
        }

        if (schema.kind === "array") {
          return (
            <FormField
              key={id}
              errors={errors}
              id={fieldId}
              label={label}
              name={id}
              description={property.description ?? "One value per line."}
            >
              {({ ariaDescribedBy, invalid }) => (
                <Textarea
                  id={fieldId}
                  name={id}
                  required={required}
                  defaultValue={Array.isArray(value) ? value.join("\n") : ""}
                  aria-invalid={invalid}
                  aria-describedby={ariaDescribedBy}
                />
              )}
            </FormField>
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
        const defaultValue = timestamp
          ? dateTimeLocalValue(value)
          : typeof value === "number"
            ? value
            : stringValue(value)

        return (
          <FormField
            key={id}
            errors={errors}
            id={fieldId}
            label={label}
            name={id}
            description={property.description}
          >
            {({ ariaDescribedBy, invalid }) =>
              longText ? (
                <Textarea
                  id={fieldId}
                  name={id}
                  required={required}
                  defaultValue={defaultValue}
                  maxLength={
                    schema.kind === "string" ? schema.maxLength : undefined
                  }
                  aria-invalid={invalid}
                  aria-describedby={ariaDescribedBy}
                />
              ) : (
                <Input
                  id={fieldId}
                  name={id}
                  type={inputType}
                  required={required}
                  defaultValue={defaultValue}
                  max={schema.kind === "number" ? schema.maximum : undefined}
                  min={schema.kind === "number" ? schema.minimum : undefined}
                  step={schema.kind === "number" && schema.integer ? 1 : "any"}
                  maxLength={
                    schema.kind === "string" ? schema.maxLength : undefined
                  }
                  minLength={
                    schema.kind === "string" ? schema.minLength : undefined
                  }
                  aria-invalid={invalid}
                  aria-describedby={ariaDescribedBy}
                />
              )
            }
          </FormField>
        )
      })}
    </>
  )
}
