import type { UseMutationOptions } from "@tanstack/react-query"

import { modelData } from "#/runtime/client/data-client.ts"
import {
  executeMutation,
  type ModelQueryOptions,
} from "#/runtime/client/model-query-client.ts"
import {
  modelTypeAccepts,
  type Batch,
  type ListRequest,
  type ModelLinkTraversal,
  type ObjectRef,
  type ObjectType,
  type Page,
  type PropertyDefinition,
} from "#/runtime/model/index.ts"
import type { ObjectTableRecord } from "#/runtime/ui/model/object-table/object-table-config.ts"
import { objectTableValueText } from "#/runtime/ui/model/object-table/object-table-config.ts"
import { type ModelUiRuntime } from "#/runtime/ui/model/runtime-context.tsx"

export type ModelObject = ObjectType

export type ClientValue =
  | boolean
  | null
  | number
  | string
  | ReadonlyArray<ClientValue>
  | { readonly [property: string]: ClientValue | undefined }

export interface ClientRecord {
  readonly objectType?: string
  readonly links?: Readonly<
    Record<
      string,
      { readonly ids: ReadonlyArray<string>; readonly totalSize: number }
    >
  >
  readonly etag: string
  readonly id: string
  readonly [property: string]: ClientValue | undefined
}

export interface ObjectRecordPresentation {
  readonly source?: ClientRecord

  readonly object: ObjectType
  readonly record: ObjectTableRecord
}

export interface RelatedRecord {
  readonly id: string
  readonly label: string
  readonly objectType: string
  readonly presentation?: ObjectRecordPresentation | undefined
}

export interface DynamicObjectClient {
  readonly batchGet: (
    input: DynamicRecordIdsInput
  ) => ModelQueryOptions<Batch<ClientRecord>>
  readonly batchDelete?: (input: {
    readonly ids: ReadonlyArray<string>
  }) => Promise<void>
  readonly create?: (
    input: Readonly<Record<string, ClientValue | undefined>>
  ) => Promise<ClientRecord>
  readonly get: (input: DynamicRecordInput) => ModelQueryOptions<ClientRecord>
  readonly list: (
    request?: ListRequest
  ) => ModelQueryOptions<Page<ClientRecord>>
  readonly update?: (
    input: Readonly<Record<string, ClientValue | undefined>> & {
      readonly etag?: string
      readonly id: string
    }
  ) => Promise<ClientRecord>
}

export interface DynamicLinkClient {
  readonly link?: (input: DynamicLinkMutationInput) => Promise<void>
  readonly list: (
    input: DynamicLinkListInput
  ) => ModelQueryOptions<Page<ClientRecord & ObjectRef>>
  readonly unlink?: (input: DynamicLinkMutationInput) => Promise<void>
}

interface DynamicRecordInput {
  readonly id: string
}

interface DynamicRecordIdsInput {
  readonly ids: ReadonlyArray<string>
}

interface DynamicLinkListInput
  extends DynamicRecordInput, Omit<ListRequest, "pageToken"> {
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
type DynamicOptions =
  | ModelQueryOptions<unknown>
  | UseMutationOptions<unknown, unknown, ModelClientRequest>

function operation(
  group: object,
  name: string
): (input?: unknown) => DynamicOptions {
  const value = Reflect.get(group, name)
  if (typeof value !== "function")
    throw new Error(`Missing model operation ${name}`)
  // SAFETY: only the generated renderer erases concrete object types from the closed model.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return value as (input?: unknown) => DynamicOptions
}

function queryMethod<A>(options: DynamicOptions): ModelQueryOptions<A> {
  // SAFETY: query names are selected from the generated model query contract.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return options as ModelQueryOptions<A>
}

function mutationMethod<A>(options: DynamicOptions, input: ModelClientRequest) {
  // SAFETY: action names are selected from the generated model action contract.
  return executeMutation(
    modelData().queryClient,
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    options as UseMutationOptions<A, unknown, ModelClientRequest>,
    input
  )
}

export function clientFor(
  runtime: ModelUiRuntime,
  object: ModelObject
): DynamicObjectClient {
  const group = Reflect.get(runtime.data, object.id)
  const get = operation(group, "get")
  const list = operation(group, "list")
  const batchGet = operation(group, "batchGet")
  return {
    get: (input) => queryMethod(get(input)),
    list: (input = {}) => queryMethod(list(input)),
    batchGet: (input) => queryMethod(batchGet(input)),
    ...("create" in object.actions
      ? {
          create: (input: ModelClientRequest) =>
            mutationMethod<ClientRecord>(operation(group, "create")(), input),
        }
      : {}),
    ...("update" in object.actions
      ? {
          update: (input: ModelClientRequest) =>
            mutationMethod<ClientRecord>(operation(group, "update")(), input),
        }
      : {}),
    ...("batchDelete" in object.actions
      ? {
          batchDelete: (input: ModelClientRequest) =>
            mutationMethod<void>(operation(group, "batchDelete")(), input),
        }
      : {}),
  }
}

/** Dynamic adapter only for the generated relationship renderer. */
export function linkClientFor(
  runtime: ModelUiRuntime,
  object: ModelObject,
  traversal: ModelLinkTraversal
): DynamicLinkClient {
  const group = Reflect.get(
    Reflect.get(runtime.data, object.id),
    traversal.traversal.key
  )
  return {
    list: (input) => queryMethod(operation(group, "list")(input)),
    ...(Object.hasOwn(group, "link")
      ? {
          link: (input: DynamicLinkMutationInput) =>
            mutationMethod<void>(operation(group, "link")(), input),
        }
      : {}),
    ...(Object.hasOwn(group, "unlink")
      ? {
          unlink: (input: DynamicLinkMutationInput) =>
            mutationMethod<void>(operation(group, "unlink")(), input),
        }
      : {}),
  }
}

export function modelObjectProperty(
  object: ModelObject,
  propertyId: string
): PropertyDefinition | undefined {
  return object.properties[propertyId]
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
      Object.entries(record.links ?? {}).flatMap(([key, value]) => [
        [key, value.ids],
        [`${key}TotalSize`, value.totalSize],
      ])
    ),
    ...Object.fromEntries(
      Object.keys(object.properties).map((property) => [
        property,
        record[property] ?? null,
      ])
    ),
  } as ObjectTableRecord
  return projected
}

export function recordLabel(object: ModelObject, record: ClientRecord): string {
  const projected = tableRecord(object, record)
  return objectTableValueText(projected[object.display.title]) || record.id
}

export function recordObjectTypes(
  runtime: ModelUiRuntime,
  typeId: string
): ReadonlyArray<ModelObject> {
  return Object.values(runtime.model.objects).filter((candidate) =>
    modelTypeAccepts(runtime.model, candidate.id, typeId)
  )
}

/** Relationship reads already return canonical records; never hydrate them again. */
export function describeReferences(
  runtime: ModelUiRuntime,
  records: ReadonlyArray<ClientRecord & ObjectRef>
): ReadonlyArray<RelatedRecord> {
  return records.map((record) => {
    const object = Object.values(runtime.model.objects).find(
      (candidate) => candidate.id === record.objectType
    )
    return {
      id: record.id,
      objectType: record.objectType,
      label: object === undefined ? record.id : recordLabel(object, record),
      ...(object === undefined
        ? {}
        : { presentation: { object, record: tableRecord(object, record) } }),
    }
  })
}

/** Polymorphic hydration shares the generated semantic query/cache boundary. */
export function recordBatchFor(
  runtime: ModelUiRuntime,
  ids: ReadonlyArray<string>
): ModelQueryOptions<{
  readonly items: ReadonlyArray<ClientRecord>
  readonly missingIds: ReadonlyArray<string>
}> {
  return queryMethod(
    operation(Reflect.get(runtime.data, "records"), "batchGet")({ ids })
  )
}
