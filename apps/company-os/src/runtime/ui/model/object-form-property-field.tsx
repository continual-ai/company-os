import { Checkbox } from "@company/ui/checkbox"
import { DateTimePicker } from "@company/ui/date-time-picker"
import { FieldError } from "@company/ui/field"
import { Input } from "@company/ui/input"
import { PhoneInput } from "@company/ui/phone-input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@company/ui/select"
import { Textarea } from "@company/ui/textarea"

import { FileField } from "#/runtime/assets/ui/file-field.tsx"
import { useTypedAppFormContext } from "#/runtime/ui/forms/app-form.ts"
import type {
  FormValue,
  FormValueObject,
} from "#/runtime/ui/forms/form-value.ts"
import type { ResolvedObjectUi } from "#/runtime/ui/model/module-ui.tsx"
import type {
  ModelObject,
  ClientRecord,
} from "#/runtime/ui/model/object-client.ts"
import {
  isSupportedFormSchema,
  objectFormFieldRequired,
  stringValue,
  type ObjectFormMode,
  type ObjectFormValues,
  type ObjectFormProperty,
} from "#/runtime/ui/model/object-form.ts"
import { ObjectReferenceSelect } from "#/runtime/ui/model/object-reference-select.tsx"

const emptyObjectFormValues: ObjectFormValues = {}
const objectFormContextOptions = { defaultValues: emptyObjectFormValues }

function isFormValueObject(value: FormValue): value is FormValueObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function nestedValue(value: FormValue, key: string): string {
  return isFormValueObject(value) ? stringValue(value[key]) : ""
}

function updateNested(
  value: FormValue,
  key: string,
  next: string
): FormValueObject {
  const current = isFormValueObject(value) ? value : {}
  return { ...current, [key]: next }
}

export function ObjectFormPropertyField({
  entry: { id, property, schema },
  object,
  mode,
  referenceLabels,
  fieldEditors,
  record,
}: {
  readonly entry: ObjectFormProperty
  readonly record?: ClientRecord | undefined
  readonly object: ModelObject
  readonly mode: ObjectFormMode
  readonly referenceLabels: ReadonlyMap<string, string>
  readonly fieldEditors?: ResolvedObjectUi["fieldEditors"]
}) {
  const form = useTypedAppFormContext(objectFormContextOptions)

  const fieldId = `${object.id}-${mode}-${id}`
  const label = property.label ?? id
  const required = objectFormFieldRequired(property)

  const Editor = fieldEditors?.[id]
  if (Editor)
    return (
      <form.AppField key={id} name={id}>
        {(field) => (
          <field.FormField id={fieldId} label={label}>
            {(control) => (
              <Editor {...control} id={fieldId} name={id} required={required} />
            )}
          </field.FormField>
        )}
      </form.AppField>
    )

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
          <field.FormField id={fieldId} label={label} orientation="horizontal">
            {({ ariaDescribedBy, invalid, onBlur, onValueChange, value }) => (
              <Checkbox
                id={fieldId}
                name={id}
                checked={value === true}
                aria-invalid={invalid}
                aria-describedby={ariaDescribedBy}
                onBlur={onBlur}
                onCheckedChange={onValueChange}
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
            {({ ariaDescribedBy, invalid, onBlur, onValueChange, value }) => {
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
            {({ ariaDescribedBy, invalid, onBlur, onValueChange, value }) => {
              const selectedValue = stringValue(value)
              const options =
                schema.options ??
                schema.values.map((option) => ({
                  label: option,
                  value: option,
                }))
              const selectedLabel = options.find(
                (option) => option.value === selectedValue
              )?.label
              return (
                <Select
                  name={id}
                  required={required}
                  value={selectedValue === "" ? null : selectedValue}
                  onValueChange={(nextValue) => onValueChange(nextValue ?? "")}
                >
                  <SelectTrigger
                    id={fieldId}
                    className="w-full"
                    aria-invalid={invalid}
                    aria-describedby={ariaDescribedBy}
                    aria-required={required}
                    onBlur={onBlur}
                  >
                    <SelectValue
                      placeholder={required ? "Choose a value" : "None"}
                    >
                      {selectedLabel}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent align="start">
                    {required ? null : (
                      <SelectItem value={null}>None</SelectItem>
                    )}
                    {options.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )
            }}
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
            {({ ariaDescribedBy, invalid, onBlur, onValueChange, value }) => (
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
                      updateNested(value, "amount", event.currentTarget.value)
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
                      updateNested(value, "currency", event.currentTarget.value)
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

  const assetSchema = schema.kind === "array" ? schema.items : schema
  if (
    assetSchema.kind === "file" ||
    assetSchema.kind === "image" ||
    assetSchema.kind === "media"
  ) {
    return (
      <form.AppField key={id} name={id}>
        {(field) => (
          <field.FormField
            id={fieldId}
            label={label}
            description={property.description}
          >
            {({ value, onValueChange }) => {
              const values = (Array.isArray(value) ? value : [value]).flatMap(
                (item) => {
                  if (
                    typeof item !== "object" ||
                    item === null ||
                    !("assetId" in item) ||
                    typeof item.assetId !== "string" ||
                    item.assetId === ""
                  )
                    return []
                  return [
                    {
                      assetId: item.assetId,
                      ...(typeof item.alt === "string"
                        ? { alt: item.alt }
                        : {}),
                    },
                  ]
                }
              )
              return (
                <form.Subscribe selector={(state) => state.values.parent}>
                  {(parent) => (
                    <FileField
                      id={fieldId}
                      value={values}
                      image={assetSchema.kind === "image"}
                      multiple={schema.kind === "array"}
                      maxBytes={assetSchema.maxBytes}
                      accept={assetSchema.accept}
                      scope={
                        record?.parent ??
                        (typeof parent === "string" && parent !== ""
                          ? parent
                          : undefined)
                      }
                      onPendingChange={(pending) =>
                        field.setMeta((meta) => ({
                          ...meta,
                          isValidating: pending,
                          isTouched: true,
                        }))
                      }
                      onChange={(next) => {
                        const nextValues = next.map((reference) => ({
                          ...reference,
                        }))
                        onValueChange(
                          schema.kind === "array"
                            ? nextValues
                            : (nextValues[0] ?? null)
                        )
                      }}
                    />
                  )}
                </form.Subscribe>
              )
            }}
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
            {({ ariaDescribedBy, invalid, onBlur, onValueChange, value }) => (
              <Textarea
                id={fieldId}
                name={id}
                required={required}
                value={stringValue(value)}
                aria-invalid={invalid}
                aria-describedby={ariaDescribedBy}
                onBlur={onBlur}
                onChange={(event) => onValueChange(event.currentTarget.value)}
              />
            )}
          </field.FormField>
        )}
      </form.AppField>
    )
  }

  const timestamp = schema.kind === "string" && schema.format === "timestamp"
  const phone = schema.kind === "string" && schema.format === "phone"
  const longText =
    schema.kind === "string" &&
    (schema.maxLength === undefined || schema.maxLength > 300) &&
    schema.format === undefined
  const inputType =
    schema.kind === "number" || schema.kind === "decimal"
      ? "number"
      : schema.kind === "string" && schema.format === "date"
        ? "date"
        : schema.kind === "string" && schema.format === "email"
          ? "email"
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
          {({ ariaDescribedBy, invalid, onBlur, onValueChange, value }) =>
            timestamp ? (
              <DateTimePicker
                id={fieldId}
                required={required}
                value={stringValue(value)}
                aria-describedby={ariaDescribedBy}
                aria-invalid={invalid}
                onBlur={onBlur}
                onValueChange={onValueChange}
              />
            ) : phone ? (
              <PhoneInput
                id={fieldId}
                name={id}
                required={required}
                value={stringValue(value)}
                maxLength={schema.maxLength}
                aria-invalid={invalid}
                aria-describedby={ariaDescribedBy}
                autoComplete="tel"
                placeholder="Enter phone number"
                onBlur={onBlur}
                onValueChange={onValueChange}
              />
            ) : longText ? (
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
                onChange={(event) => onValueChange(event.currentTarget.value)}
              />
            ) : (
              <Input
                id={fieldId}
                name={id}
                type={inputType}
                required={required}
                value={stringValue(value)}
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
                onBlur={onBlur}
                onChange={(event) => onValueChange(event.currentTarget.value)}
              />
            )
          }
        </field.FormField>
      )}
    </form.AppField>
  )
}
