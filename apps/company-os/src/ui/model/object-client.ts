/* oxlint-disable anti-slop/no-reflect-get, anti-slop/no-runtime-typeof -- This model adapter validates reflected endpoints before invoking them. */
import { Model } from "@company/model"
import {
  type Batch,
  type ModelLinkTraversal,
  modelTypeAccepts,
  type ListRequest,
  type ObjectRef,
  type Page,
  type PropertyDefinition,
} from "@company/runtime"
import { Effect } from "effect"

import { client } from "@/app-client"

import { objectTableValueText } from "./object-table/object-table-config"
import type { ObjectTableRecord } from "./object-table/object-table-config"

export type ModelObject = (typeof Model.objects)[keyof typeof Model.objects]

export type ClientValue =
  | boolean
  | null
  | number
  | string
  | ReadonlyArray<ClientValue>
  | { readonly [property: string]: ClientValue | undefined }

export interface ClientRecord {
  readonly etag: string
  readonly id: string
  readonly parent?: string
  readonly [property: string]: ClientValue | undefined
}

export interface RelatedRecord {
  readonly id: string
  readonly label: string
  readonly objectType: string
}

export interface DynamicObjectClient {
  readonly batchGet: (
    input: DynamicRecordIdsInput
  ) => Promise<Batch<ClientRecord>>
  readonly batchDelete?: (input: {
    readonly ids: ReadonlyArray<string>
  }) => Promise<void>
  readonly create?: (
    input: Readonly<Record<string, ClientValue | undefined>>
  ) => Promise<ClientRecord>
  readonly delete?: (input: {
    readonly etag?: string
    readonly id: string
  }) => Promise<void>
  readonly get: (input: DynamicRecordInput) => Promise<ClientRecord>
  readonly list: (request?: ListRequest) => Promise<Page<ClientRecord>>
  readonly update?: (
    input: Readonly<Record<string, ClientValue | undefined>> & {
      readonly etag?: string
      readonly id: string
    }
  ) => Promise<ClientRecord>
}

export interface DynamicLinkClient {
  readonly link?: (input: DynamicLinkMutationInput) => Promise<void>
  readonly list: (input: DynamicLinkListInput) => Promise<Page<ObjectRef>>
  readonly unlink?: (input: DynamicLinkMutationInput) => Promise<void>
}

interface DynamicRecordInput {
  readonly id: string
}

interface DynamicRecordIdsInput {
  readonly ids: ReadonlyArray<string>
}

export interface DynamicLinkListInput extends DynamicRecordInput {
  readonly pageSize?: number
  readonly pageToken?: string
}

interface DynamicLinkMutationInput extends DynamicRecordInput {
  readonly target: string
}

type ModelClientRequest =
  | DynamicLinkListInput
  | DynamicLinkMutationInput
  | DynamicRecordIdsInput
  | ListRequest
  | Readonly<Record<string, ClientValue | undefined>>
type ModelMethod = (
  request: ModelClientRequest
) => Effect.Effect<unknown, unknown>

type DynamicObjectClientBuilder = {
  -readonly [TKey in keyof DynamicObjectClient]: DynamicObjectClient[TKey]
}

interface DynamicLinkClientBuilder {
  link?: NonNullable<DynamicLinkClient["link"]>
  list: DynamicLinkClient["list"]
  unlink?: NonNullable<DynamicLinkClient["unlink"]>
}

function modelMethod(object: ModelObject, operation: string): ModelMethod {
  const group = Reflect.get(client, object.id)
  const method = Reflect.get(group, operation)
  if (typeof method !== "function") {
    throw new Error(
      `Model client method '${object.id}.${operation}' is missing.`
    )
  }
  // SAFETY: client and this adapter are projected from the same closed Model.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return method as ModelMethod
}

function linkMethod(
  object: ModelObject,
  traversal: ModelLinkTraversal,
  operation: string
): ModelMethod | undefined {
  const group = Reflect.get(client, object.id)
  const links = Reflect.get(group, traversal.traversal.key)
  if (typeof links !== "object" || links === null) {
    throw new Error(
      `Model client Link '${object.id}.${traversal.traversal.key}' is missing.`
    )
  }
  const method = Reflect.get(links, operation)
  if (method === undefined) return undefined
  if (typeof method !== "function") {
    throw new Error(
      `Model client Link method '${object.id}.${traversal.traversal.key}.${operation}' is invalid.`
    )
  }
  // SAFETY: client and this adapter are projected from the same closed Model.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return method as ModelMethod
}

async function runMethod<TResult>(effect: Effect.Effect<unknown, unknown>) {
  // SAFETY: every result is decoded by the generated native Effect client.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return Effect.runPromise(effect) as Promise<TResult>
}

export function clientFor(object: ModelObject): DynamicObjectClient {
  const batchGet = modelMethod(object, "batchGet")
  const get = modelMethod(object, "get")
  const list = modelMethod(object, "list")
  const adapter: DynamicObjectClientBuilder = {
    batchGet: (input) => runMethod(batchGet(input)),
    get: (input) => runMethod(get(input)),
    list: (request = {}) => runMethod(list(request)),
  }

  if ("batchDelete" in object.actions) {
    const method = modelMethod(object, "batchDelete")
    adapter.batchDelete = (input) => runMethod(method(input))
  }
  if ("create" in object.actions) {
    const method = modelMethod(object, "create")
    adapter.create = (input) => runMethod(method(input))
  }
  if ("delete" in object.actions) {
    const method = modelMethod(object, "delete")
    adapter.delete = (input) => runMethod(method(input))
  }
  if ("update" in object.actions) {
    const method = modelMethod(object, "update")
    adapter.update = (input) => runMethod(method(input))
  }

  return adapter
}

/** Dynamic adapter used only by model-generated relationship UI. */
export function linkClientFor(
  object: ModelObject,
  traversal: ModelLinkTraversal
): DynamicLinkClient {
  const list = linkMethod(object, traversal, "list")
  if (list === undefined) {
    throw new Error(
      `Model client Link method '${object.id}.${traversal.traversal.key}.list' is missing.`
    )
  }
  const link = linkMethod(object, traversal, "link")
  const unlink = linkMethod(object, traversal, "unlink")
  const adapter: DynamicLinkClientBuilder = {
    list: (input) => runMethod(list(input)),
  }
  if (link !== undefined) {
    adapter.link = (input) => runMethod<void>(link(input))
  }
  if (unlink !== undefined) {
    adapter.unlink = (input) => runMethod<void>(unlink(input))
  }
  return adapter
}

export function modelObjectProperty(
  object: ModelObject,
  propertyId: string
): PropertyDefinition | undefined {
  // SAFETY: a closed-model object's heterogeneous property map is read through
  // its common normalized PropertyDefinition contract.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const properties = object.properties as Readonly<
    Record<string, PropertyDefinition>
  >
  return properties[propertyId]
}

export function tableRecord(
  object: ModelObject,
  record: ClientRecord
): ObjectTableRecord {
  // SAFETY: the server validates responses from the same model projected by
  // the table; only declared presentation properties cross this adapter.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const projected = {
    id: record.id,
    systemManaged: record.systemManaged === true,
    ...Object.fromEntries(
      Object.keys(object.properties).map((property) => [
        property,
        record[property] ?? null,
      ])
    ),
  } as ObjectTableRecord
  if (object.parent.kind !== "root") projected.parent = record.parent ?? null
  return projected
}

export function recordLabel(object: ModelObject, record: ClientRecord): string {
  const projected = tableRecord(object, record)
  return objectTableValueText(projected[object.display.title]) || record.id
}

export function recordObjectTypes(typeId: string): ReadonlyArray<ModelObject> {
  return Object.values(Model.objects).filter((candidate) =>
    modelTypeAccepts(Model, candidate.id, typeId)
  )
}

export async function describeReferences(
  references: ReadonlyArray<ObjectRef>
): Promise<ReadonlyArray<RelatedRecord>> {
  const labels = new Map<string, string>()
  const byType = new Map<string, ObjectRef[]>()
  for (const reference of references) {
    const typedReferences = byType.get(reference.objectType) ?? []
    typedReferences.push(reference)
    byType.set(reference.objectType, typedReferences)
  }
  await Promise.all(
    [...byType].map(async ([objectType, typedReferences]) => {
      if (objectType === Model.root.id) {
        for (const reference of typedReferences) {
          labels.set(reference.id, Model.root.name)
        }
        return
      }
      const object = Object.values(Model.objects).find(
        (candidate) => candidate.id === objectType
      )
      if (object === undefined) return
      const records = await clientFor(object).batchGet({
        ids: typedReferences.map(({ id }) => id),
      })
      for (const record of records.items) {
        labels.set(record.id, recordLabel(object, record))
      }
    })
  )
  return references.map(({ id, objectType }) => ({
    id,
    label: labels.get(id) ?? id,
    objectType,
  }))
}

export function parentName(object: ModelObject): string {
  const parent = object.parent
  if (parent.kind === "root") return Model.root.name
  const definition =
    parent.kind === "object"
      ? Object.values(Model.objects).find(({ id }) => id === parent.typeId)
      : Object.values(Model.interfaces).find(({ id }) => id === parent.typeId)
  if (definition === undefined) {
    throw new Error(`Unknown parent type '${parent.typeId}'.`)
  }
  return definition.name
}
