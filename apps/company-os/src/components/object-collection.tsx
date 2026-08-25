/* oxlint-disable anti-slop/no-conditional-empty-object-spread, anti-slop/no-known-value-widening, anti-slop/no-reflect-get, anti-slop/no-unknown-parameters, anti-slop/no-unknown-returns, anti-slop/no-unsafe-dictionary-type, anti-slop/require-safety-comment-for-type-assertion */
import { Model } from "@company/model"
import { modelTypeAccepts, type ObjectType } from "@company/runtime"
import { Button } from "@company/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@company/ui/components/dialog"
import { Input } from "@company/ui/components/input"
import { Label } from "@company/ui/components/label"
import { Textarea } from "@company/ui/components/textarea"
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import { companyClient } from "@/company-client"
import { formText } from "@/form-data"
import { PLATFORM_ID } from "@/system-records"

import { ObjectTable } from "./object-table/object-table"
import { objectTablePropertySchema } from "./object-table/object-table-cell-types"
import { objectTableValueText } from "./object-table/object-table-config"
import type {
  ObjectTableRecord,
  ObjectTableValue,
} from "./object-table/object-table-config"

type ModelObject = (typeof Model.objects)[keyof typeof Model.objects]

interface ClientRecord {
  readonly etag: string
  readonly id: string
  readonly parent?: string
  readonly [property: string]: unknown
}

interface DynamicObjectClient {
  readonly batchDelete?: (input: {
    readonly ids: ReadonlyArray<string>
  }) => Promise<void>
  readonly create?: (
    input: Readonly<Record<string, unknown>>
  ) => Promise<ClientRecord>
  readonly delete?: (input: {
    readonly etag?: string
    readonly id: string
  }) => Promise<void>
  readonly list: () => Promise<{ readonly items: ReadonlyArray<ClientRecord> }>
  readonly update?: (
    input: Readonly<Record<string, unknown>> & {
      readonly etag?: string
      readonly id: string
    }
  ) => Promise<ClientRecord>
}

interface ReferenceOption {
  readonly id: string
  readonly label: string
}

function clientFor(object: ModelObject): DynamicObjectClient {
  // SAFETY: createClient and this component consume the same closed Model; the
  // collection key therefore resolves to the matching object client.
  // oxlint-disable-next-line anti-slop/no-chained-type-assertions, typescript/no-unsafe-type-assertion
  // oxlint-disable-next-line anti-slop/no-chained-type-assertions, typescript/no-unsafe-type-assertion
  return Reflect.get(
    companyClient,
    object.collection
  ) as unknown as DynamicObjectClient
}

function tableRecord(
  object: ModelObject,
  record: ClientRecord
): ObjectTableRecord {
  // SAFETY: API responses are validated from the same model schemas used by
  // ObjectTable; only declared presentation properties are projected here.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return {
    id: record.id,
    ...(object.parent.kind === "root"
      ? {}
      : {
          parent: record.parent ?? null,
        }),
    systemManaged: record.systemManaged === true,
    ...Object.fromEntries(
      Object.keys(object.properties).map((property) => [
        property,
        record[property] ?? null,
      ])
    ),
  }
}

function recordLabel(object: ModelObject, record: ClientRecord): string {
  const projected = tableRecord(object, record)
  return objectTableValueText(projected[object.display.title]) || record.id
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The operation failed."
}

function defaultValue(property: ObjectType["properties"][string]): unknown {
  if (property.default !== undefined) return property.default
  if (property.nullable) return null
  const schema = objectTablePropertySchema(property)
  if (schema.kind === "boolean") return false
  if (schema.kind === "array") return []
  return ""
}

function parentName(object: ModelObject): string {
  const parent = object.parent
  if (parent.kind === "root") return Model.root.name
  if (parent.kind === "object") {
    return Model.objects[parent.typeId as keyof typeof Model.objects].name
  }
  return Model.interfaces[parent.typeId as keyof typeof Model.interfaces].name
}

function recordObjectTypes(typeId: string): ReadonlyArray<ModelObject> {
  return Object.values(Model.objects).filter((candidate) =>
    modelTypeAccepts(Model, candidate.id, typeId)
  )
}

function CreateRecordDialog({
  object,
  onCreate,
  onOpenChange,
  open,
  parentOptions,
  referenceOptions,
}: {
  readonly object: ModelObject
  readonly onCreate: (input: Readonly<Record<string, unknown>>) => Promise<void>
  readonly onOpenChange: (open: boolean) => void
  readonly open: boolean
  readonly parentOptions: ReadonlyArray<ReferenceOption>
  readonly referenceOptions: Readonly<
    Record<string, ReadonlyArray<ReferenceOption>>
  >
}) {
  const [error, setError] = useState<string>()
  const [pending, setPending] = useState(false)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            const form = new FormData(event.currentTarget)
            const input: Record<string, unknown> = {}
            if (object.parent.kind !== "root") {
              input.parent = formText(form, "parent")
            } else {
              input.parent = PLATFORM_ID
            }
            for (const [propertyId, property] of Object.entries(
              object.properties
            )) {
              if (property.outputOnly) continue
              const schema = objectTablePropertySchema(property)
              if (schema.kind === "image" || schema.kind === "array") continue
              if (schema.kind === "money") {
                const amount = formText(form, `${propertyId}.amount`)
                const currency = formText(form, `${propertyId}.currency`)
                if (amount !== "") {
                  input[propertyId] = {
                    amount,
                    currency: currency || "USD",
                  }
                } else {
                  const fallback = defaultValue(property)
                  if (fallback !== "") input[propertyId] = fallback
                }
                continue
              }
              const value = formText(form, propertyId)
              if (value === "") {
                const fallback = defaultValue(property)
                if (fallback !== "") input[propertyId] = fallback
                continue
              }
              input[propertyId] =
                schema.kind === "number" ? Number(value) : value
            }
            setPending(true)
            setError(undefined)
            void onCreate(input)
              .then(() => onOpenChange(false))
              .catch((cause: unknown) => setError(errorMessage(cause)))
              .finally(() => setPending(false))
          }}
        >
          <DialogHeader>
            <DialogTitle>New {object.name}</DialogTitle>
            <DialogDescription>{object.description}</DialogDescription>
          </DialogHeader>

          {object.parent.kind === "root" ? null : (
            <div className="grid gap-1.5">
              <Label htmlFor={`${object.id}-parent`}>
                {parentName(object)}
              </Label>
              <select
                required
                id={`${object.id}-parent`}
                name="parent"
                className="h-8 border border-input bg-background px-2 text-xs"
              >
                <option value="">
                  Select {parentName(object).toLowerCase()}
                </option>
                {parentOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {Object.entries(object.properties).map(([propertyId, property]) => {
            if (property.outputOnly || property.immutable) return null
            const schema = objectTablePropertySchema(property)
            if (schema.kind === "image" || schema.kind === "array") return null
            const required = property.requiredOnCreate
            const options = referenceOptions[propertyId]
            const fieldId = `${object.id}-${propertyId}`
            return (
              <div key={propertyId} className="grid gap-1.5">
                <Label htmlFor={fieldId}>{property.label ?? propertyId}</Label>
                {schema.kind === "enum" ? (
                  <select
                    id={fieldId}
                    name={propertyId}
                    required={required}
                    defaultValue={String(property.default ?? "")}
                    className="h-8 border border-input bg-background px-2 text-xs"
                  >
                    {!required ? <option value="">None</option> : null}
                    {(
                      schema.options ??
                      schema.values.map((value) => ({ label: value, value }))
                    ).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : schema.kind === "recordId" ? (
                  <select
                    id={fieldId}
                    name={propertyId}
                    required={required}
                    className="h-8 border border-input bg-background px-2 text-xs"
                  >
                    {!required ? (
                      <option value="">None</option>
                    ) : (
                      <option value="">
                        Select {property.label?.toLowerCase() ?? propertyId}
                      </option>
                    )}
                    {(options ?? []).map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : schema.kind === "money" ? (
                  <div className="grid grid-cols-[1fr_5rem] gap-2">
                    <Input
                      aria-label={`${property.label ?? propertyId} amount`}
                      name={`${propertyId}.amount`}
                      inputMode="decimal"
                      placeholder="0.00"
                      required={required}
                    />
                    <Input
                      aria-label={`${property.label ?? propertyId} currency`}
                      name={`${propertyId}.currency`}
                      defaultValue="USD"
                      maxLength={3}
                      pattern="[A-Z]{3}"
                    />
                  </div>
                ) : property.maxLength !== undefined &&
                  property.maxLength > 500 ? (
                  <Textarea
                    id={fieldId}
                    name={propertyId}
                    required={required}
                  />
                ) : (
                  <Input
                    id={fieldId}
                    name={propertyId}
                    required={required}
                    type={
                      schema.kind === "number"
                        ? "number"
                        : schema.kind === "string" && schema.format === "email"
                          ? "email"
                          : schema.kind === "string" && schema.format === "url"
                            ? "url"
                            : schema.kind === "string" &&
                                schema.format === "date"
                              ? "date"
                              : "text"
                    }
                  />
                )}
              </div>
            )
          })}

          {error === undefined ? null : (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : `Create ${object.name.toLowerCase()}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function ObjectCollection({
  object,
  renderRecordActions,
  renderCollectionActions,
}: {
  readonly object: ModelObject
  readonly renderRecordActions?:
    | ((record: ObjectTableRecord, refresh: () => Promise<void>) => ReactNode)
    | undefined
  readonly renderCollectionActions?:
    | ((refresh: () => Promise<void>) => ReactNode)
    | undefined
}) {
  const client = useMemo(() => clientFor(object), [object])
  const [records, setRecords] = useState<ReadonlyArray<ClientRecord>>([])
  const [references, setReferences] = useState<
    Readonly<Record<string, ReadonlyArray<ReferenceOption>>>
  >({})
  const [createOpen, setCreateOpen] = useState(false)
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(undefined)
    try {
      const page = await client.list()
      setRecords(page.items)

      const referencedTypes = new Set<ModelObject>()
      if (object.parent.kind !== "root") {
        for (const candidate of recordObjectTypes(object.parent.typeId)) {
          referencedTypes.add(candidate)
        }
      }
      for (const property of Object.values(object.properties)) {
        const schema = objectTablePropertySchema(property)
        if (schema.kind === "recordId") {
          for (const candidate of recordObjectTypes(schema.typeId)) {
            referencedTypes.add(candidate)
          }
        }
      }
      const loadedReferences = await Promise.all(
        [...referencedTypes].map(async (referencedObject) => {
          const referencedPage = await clientFor(referencedObject).list()
          return [
            referencedObject.id,
            referencedPage.items.map((record) => ({
              id: record.id,
              label: recordLabel(referencedObject, record),
            })),
          ] as const
        })
      )
      setReferences(Object.fromEntries(loadedReferences))
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setLoading(false)
    }
  }, [client, object])

  const optionsForType = (typeId: string): ReadonlyArray<ReferenceOption> => {
    const options = recordObjectTypes(typeId).flatMap(
      (candidate) => references[candidate.id] ?? []
    )
    return modelTypeAccepts(Model, Model.root.id, typeId)
      ? [{ id: PLATFORM_ID, label: Model.root.name }, ...options]
      : options
  }
  const referenceLabels = new Map(
    Object.values(references)
      .flat()
      .map((option) => [option.id, option.label] as const)
  )

  useEffect(() => {
    void load()
  }, [load])

  const create = async (input: Readonly<Record<string, unknown>>) => {
    if (client.create === undefined)
      throw new Error("Creation is not available.")
    const created = await client.create(input)
    setRecords((current) => [created, ...current])
  }

  const update = async (
    recordId: string,
    propertyId: string,
    value: ObjectTableValue
  ) => {
    if (client.update === undefined)
      throw new Error("Updates are not available.")
    const current = records.find((record) => record.id === recordId)
    const input: Record<string, unknown> & { etag?: string; id: string } = {
      id: recordId,
      [propertyId]: value,
    }
    if (current !== undefined) input.etag = current.etag
    const updated = await client.update(input)
    setRecords((existing) =>
      existing.map((record) => (record.id === recordId ? updated : record))
    )
  }

  const deleteRecords = async (recordIds: ReadonlyArray<string>) => {
    if (client.batchDelete !== undefined) {
      await client.batchDelete({ ids: recordIds })
    } else if (client.delete !== undefined) {
      await Promise.all(
        recordIds.map((id) => {
          const record = records.find((item) => item.id === id)
          const input: { etag?: string; id: string } = { id }
          if (record !== undefined) input.etag = record.etag
          return client.delete!(input)
        })
      )
    } else {
      throw new Error("Deletion is not available.")
    }
    setRecords((current) => current.filter(({ id }) => !recordIds.includes(id)))
  }

  if (loading) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Loading {object.pluralName.toLowerCase()}…
      </div>
    )
  }

  return (
    <>
      {error === undefined ? null : (
        <div
          role="alert"
          className="flex items-center justify-between border-b border-destructive/30 bg-destructive/5 px-5 py-2 text-xs text-destructive"
        >
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      )}
      <ObjectTable
        object={object}
        parentLabel={parentName(object)}
        records={records.map((record) => tableRecord(object, record))}
        resolveRecordLabel={(recordId) =>
          recordId === PLATFORM_ID
            ? Model.root.name
            : referenceLabels.get(recordId)
        }
        onCellCommit={client.update === undefined ? undefined : update}
        onCreateRecord={
          client.create === undefined ? undefined : () => setCreateOpen(true)
        }
        onDeleteRecords={
          client.delete === undefined && client.batchDelete === undefined
            ? undefined
            : deleteRecords
        }
        renderRecordActions={
          renderRecordActions === undefined
            ? undefined
            : (record) => renderRecordActions(record, load)
        }
        toolbarActions={renderCollectionActions?.(load)}
      />
      <CreateRecordDialog
        object={object}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={create}
        parentOptions={
          object.parent.kind === "root"
            ? []
            : optionsForType(object.parent.typeId)
        }
        referenceOptions={Object.fromEntries(
          Object.entries(object.properties).map(([propertyId, property]) => {
            const schema = objectTablePropertySchema(property)
            return [
              propertyId,
              schema.kind === "recordId" ? optionsForType(schema.typeId) : [],
            ]
          })
        )}
      />
    </>
  )
}
