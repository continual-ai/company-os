import { Button } from "@company/ui/button"
import { Checkbox } from "@company/ui/checkbox"
import { DateTimePicker } from "@company/ui/date-time-picker"
import { FieldError } from "@company/ui/field"
import { Input } from "@company/ui/input"
import { MarkdownEditor } from "@company/ui/markdown-editor"
import { PhoneInput } from "@company/ui/phone-input"
import { ScoreInput } from "@company/ui/score"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@company/ui/select"
import { Textarea } from "@company/ui/textarea"

import { FileField } from "#/runtime/assets/ui/file-field.tsx"
import { containsSecret } from "#/runtime/model/definition/schema.ts"
import type { AnySchema } from "#/runtime/model/index.ts"
import { useTypedAppFormContext } from "#/runtime/ui/forms/app-form.ts"
import type {
  FormValue,
  FormValueObject,
} from "#/runtime/ui/forms/form-value.ts"
import { isSupportedFormSchema } from "#/runtime/ui/forms/schema-form-values.ts"
import {
  schemaFormDefault,
  unionMember,
} from "#/runtime/ui/forms/schema-form-values.ts"
import type { ResolvedObjectUi } from "#/runtime/ui/model/module-ui.tsx"
import {
  stringValue,
  type ObjectFormValues,
} from "#/runtime/ui/model/object-form.ts"
import { RecordSelect } from "#/runtime/ui/model/record-select.tsx"

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

/** Shared schema controls for Object properties and operation parameters. */
export function SchemaFormField({
  id,
  schema,
  fieldId,
  required,
  json = false,
  referenceLabels,
  fieldEditors,
}: {
  readonly id: string
  readonly schema: AnySchema
  readonly fieldId: string
  readonly json?: boolean
  readonly required: boolean
  readonly referenceLabels: ReadonlyMap<string, string>
  readonly fieldEditors?: ResolvedObjectUi["fieldEditors"]
}) {
  const form = useTypedAppFormContext(objectFormContextOptions)
  const property = schema
  const label =
    property.label ??
    (schema.kind === "optional" ? schema.value.label : undefined) ??
    id
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

  if (schema.kind === "string" && schema.secret) {
    return (
      <form.AppField name={id}>
        {(field) => (
          <field.FormField
            id={fieldId}
            label={label}
            description={schema.description}
          >
            {({ value, onValueChange, onBlur, invalid, ariaDescribedBy }) => {
              const present = isFormValueObject(value) && "hint" in value
              return (
                <div className="flex items-center gap-2">
                  {present ? (
                    <>
                      <span className="flex-1 text-sm">
                        {typeof value.hint === "string" ? value.hint : "Set"}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => onValueChange("")}
                      >
                        Replace
                      </Button>
                    </>
                  ) : (
                    <Input
                      id={fieldId}
                      name={id}
                      type="password"
                      autoComplete="new-password"
                      value={stringValue(value)}
                      required={required}
                      onBlur={onBlur}
                      aria-invalid={invalid}
                      aria-describedby={ariaDescribedBy}
                      onChange={(event) =>
                        onValueChange(event.currentTarget.value)
                      }
                    />
                  )}
                  {schema.nullable && value !== null ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => onValueChange(null)}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
              )
            }}
          </field.FormField>
        )}
      </form.AppField>
    )
  }

  if (schema.kind === "literal") return null

  if (
    schema.kind === "optional" ||
    (schema.nullable && (schema.kind === "struct" || schema.kind === "union"))
  ) {
    const inner =
      schema.kind === "optional" ? schema.value : { ...schema, nullable: false }
    return (
      <form.AppField name={id}>
        {(field) => (
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={
                  field.state.value !== null && field.state.value !== undefined
                }
                onCheckedChange={(checked) => {
                  form.setErrorMap({ onSubmit: undefined })
                  field.handleChange(checked ? schemaFormDefault(inner) : null)
                }}
              />
              {label}
            </label>
            {field.state.value !== null && field.state.value !== undefined ? (
              <SchemaFormField
                id={id}
                schema={inner}
                fieldId={fieldId}
                required={true}
                referenceLabels={referenceLabels}
                json={json}
                fieldEditors={fieldEditors}
              />
            ) : null}
          </div>
        )}
      </form.AppField>
    )
  }

  if (
    schema.kind === "struct" ||
    (schema.kind === "union" && schema.discriminator !== undefined)
  ) {
    return (
      <form.AppField name={id}>
        {(field) => {
          const member =
            schema.kind === "struct"
              ? schema
              : unionMember(schema, field.state.value)
          const tagField =
            schema.kind === "union" && schema.discriminator
              ? member?.properties[schema.discriminator]
              : undefined
          const discriminator =
            schema.kind === "union" ? schema.discriminator : undefined
          return (
            <fieldset className="min-w-0 space-y-3 rounded-md border p-3">
              <legend className="px-1 text-sm font-medium">{label}</legend>
              {schema.description ? (
                <p className="text-muted-foreground text-sm">
                  {schema.description}
                </p>
              ) : null}
              {schema.kind === "union" ? (
                <Select
                  value={
                    tagField?.kind === "literal" ? String(tagField.value) : null
                  }
                  onValueChange={(tag) => {
                    const next = unionMember(schema, { [discriminator!]: tag })
                    if (next) {
                      form.setErrorMap({ onSubmit: undefined })
                      field.handleChange(schemaFormDefault(next))
                    }
                  }}
                >
                  <SelectTrigger id={fieldId} aria-label={label}>
                    <SelectValue>
                      {member?.label ??
                        (tagField?.kind === "literal"
                          ? String(tagField.value)
                          : undefined)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {schema.members.map((variant) => {
                      if (variant.kind !== "struct") return null
                      const tag = variant.properties[discriminator!]
                      if (tag?.kind !== "literal") return null
                      return (
                        <SelectItem
                          key={String(tag.value)}
                          value={String(tag.value)}
                        >
                          {variant.label ?? String(tag.value)}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              ) : null}
              {schema.kind === "union" && member?.description ? (
                <p className="text-muted-foreground text-sm">
                  {member.description}
                </p>
              ) : null}
              {member
                ? Object.entries(member.properties)
                    .filter(
                      ([key, child]) =>
                        key !== discriminator && !child.outputOnly
                    )
                    .map(([key, child]) => (
                      <SchemaFormField
                        key={`${tagField?.kind === "literal" ? tagField.value : ""}:${key}`}
                        id={`${id}.${key}`}
                        schema={{
                          ...child,
                          label:
                            child.label ??
                            (child.kind === "optional"
                              ? child.value.label
                              : undefined) ??
                            key,
                        }}
                        fieldId={`${fieldId}-${key}`}
                        required={
                          child.kind !== "optional" &&
                          !child.nullable &&
                          child.default === undefined
                        }
                        referenceLabels={referenceLabels}
                        json={json}
                        fieldEditors={fieldEditors}
                      />
                    ))
                : null}
            </fieldset>
          )
        }}
      </form.AppField>
    )
  }

  if (schema.kind === "json" || !isSupportedFormSchema(schema)) {
    if (schema.kind !== "json" && (!json || containsSecret(schema)))
      return (
        <FieldError>
          {label} uses the unsupported {schema.kind} form type.
        </FieldError>
      )
    return (
      <form.AppField name={id}>
        {(field) => (
          <field.FormField
            id={fieldId}
            label={label}
            description={schema.description ?? "Enter a JSON value."}
          >
            {({ value, onValueChange, onBlur, invalid, ariaDescribedBy }) => (
              <Textarea
                id={fieldId}
                name={id}
                value={stringValue(value)}
                onChange={(event) => onValueChange(event.currentTarget.value)}
                onBlur={onBlur}
                aria-invalid={invalid}
                aria-describedby={ariaDescribedBy}
                required={required}
              />
            )}
          </field.FormField>
        )}
      </form.AppField>
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
                <RecordSelect
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
                <FileField
                  id={fieldId}
                  value={values}
                  image={assetSchema.kind === "image"}
                  multiple={schema.kind === "array"}
                  maxBytes={assetSchema.maxBytes}
                  accept={assetSchema.accept}
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
            ) : schema.kind === "string" && schema.format === "markdown" ? (
              <MarkdownEditor
                id={fieldId}
                name={id}
                required={required}
                value={stringValue(value)}
                maxLength={schema.maxLength}
                minLength={schema.minLength}
                aria-invalid={invalid}
                aria-describedby={ariaDescribedBy}
                onBlur={onBlur}
                onValueChange={onValueChange}
              />
            ) : schema.kind === "number" && schema.format === "score" ? (
              <ScoreInput
                id={fieldId}
                name={id}
                required={required}
                label={label}
                min={schema.minimum}
                max={schema.maximum}
                value={stringValue(value)}
                aria-invalid={invalid}
                aria-describedby={ariaDescribedBy}
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
                autoComplete={undefined}
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
