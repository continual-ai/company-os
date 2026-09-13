import type { UseMutationOptions } from "@tanstack/react-query"

import { modelData } from "#/runtime/client/model-cache.ts"
import {
  executeMutation,
  modelQuery,
  modelList,
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
import { linkPreview } from "#/runtime/model/record-links.ts"
import {
  type ObjectTableRecord,
  objectTableValueText,
} from "#/runtime/ui/model/object-table/object-table-config.ts"
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
      | string
      | ClientRecord
      | {
          readonly items: ReadonlyArray<ClientRecord>
          readonly totalSize: number
        }
      | null
      | { readonly ids: ReadonlyArray<string>; readonly totalSize: number }
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
  readonly list: ReturnType<typeof modelList<ClientRecord>>
  readonly update?: (
    input: Readonly<Record<string, ClientValue | undefined>> & {
      readonly etag?: string
      readonly id: string
    }
  ) => Promise<ClientRecord>
}

export interface DynamicLinkClient {
  readonly link?: (input: DynamicLinkMutationInput) => Promise<void>
  readonly list: ReturnType<
    typeof modelList<ClientRecord & ObjectRef, unknown, DynamicLinkListInput>
  >
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
  name: string,
  factory: "queryOptions" | "mutationOptions" = "queryOptions"
): (input?: unknown) => DynamicOptions {
  const value = Reflect.get(Reflect.get(group, name), factory)
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
    get: (input) => queryMethod(get({ expand: true, ...input })),
    list: modelList((input: ListRequest) =>
      queryMethod<Page<ClientRecord>>(list(input))
    ),
    batchGet: (input) => queryMethod(batchGet(input)),
    ...("create" in object.actions
      ? {
          create: (input: ModelClientRequest) =>
            mutationMethod<ClientRecord>(
              operation(group, "create", "mutationOptions")(),
              input
            ),
        }
      : {}),
    ...("update" in object.actions
      ? {
          update: (input: ModelClientRequest) =>
            mutationMethod<ClientRecord>(
              operation(group, "update", "mutationOptions")(),
              input
            ),
        }
      : {}),
    ...("batchDelete" in object.actions
      ? {
          batchDelete: (input: ModelClientRequest) =>
            mutationMethod<void>(
              operation(group, "batchDelete", "mutationOptions")(),
              input
            ),
        }
      : {}),
  }
}

/** Dynamic adapter only for the generated relationship renderer. */
export function linkClientFor(
  runtime: ModelUiRuntime,
  object: ModelObject,
  traversal: ModelLinkTraversal,
  source: ClientRecord
): DynamicLinkClient {
  const group = Reflect.get(
    Reflect.get(runtime.data, object.id),
    traversal.traversal.key
  )
  if (traversal.traversal.max === 1) {
    const objectClient = clientFor(runtime, object)
    const assign = async (
      input: DynamicLinkMutationInput,
      target: string | null
    ) => {
      const record = source
      if (!objectClient.update)
        throw new Error("This relationship is read-only.")
      if (
        target === null &&
        linkPreview(record.links?.[traversal.traversal.key]).ids[0] !==
          input.target
      )
        throw new Error(
          "This relationship changed. Refresh before clearing it."
        )
      await objectClient.update({
        id: record.id,
        etag: record.etag,
        links: { [traversal.traversal.key]: target },
      })
    }
    return {
      list: modelList(({ id }: DynamicLinkListInput) => {
        const query = queryMethod<{ item: (ClientRecord & ObjectRef) | null }>(
          operation(group, "get")({ id })
        )
        return modelQuery<Page<ClientRecord & ObjectRef>>(
          query.meta.objectTypes,
          `${traversal.traversal.key}.page`,
          { id },
          async (signal) => {
            const { item } = await query.queryFn({ signal })
            return {
              items: item === null ? [] : [item],
              nextPageToken: null,
              totalSize: item === null ? 0 : 1,
            }
          }
        )
      }),
      ...(traversal.writable && objectClient.update
        ? {
            link: (input: DynamicLinkMutationInput) =>
              assign(input, input.target),
            ...(traversal.traversal.min === 0
              ? {
                  unlink: (input: DynamicLinkMutationInput) =>
                    assign(input, null),
                }
              : {}),
          }
        : {}),
    }
  }
  return {
    list: modelList((input: DynamicLinkListInput) =>
      queryMethod<Page<ClientRecord & ObjectRef>>(
        operation(group, "list")(input)
      )
    ),
    ...(Object.hasOwn(group, "link")
      ? {
          link: (input: DynamicLinkMutationInput) =>
            mutationMethod<void>(
              operation(group, "link", "mutationOptions")(),
              input
            ),
        }
      : {}),
    ...(Object.hasOwn(group, "unlink")
      ? {
          unlink: (input: DynamicLinkMutationInput) =>
            mutationMethod<void>(
              operation(group, "unlink", "mutationOptions")(),
              input
            ),
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
    label: record.label,
    systemManaged: record.systemManaged === true,
    ...Object.fromEntries(
      Object.entries(record.links ?? {}).flatMap(([key, value]) => [
        [key, linkPreview(value).ids],
        [`${key}TotalSize`, linkPreview(value).totalSize],
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
  if (typeof record.label === "string") return record.label
  return (
    objectTableValueText(tableRecord(object, record)[object.display.title]) ||
    record.id
  )
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

/** Only the generated Action form selects an operation dynamically. */
export function actionOptions(
  runtime: ModelUiRuntime,
  action: { readonly objectType?: string | undefined; readonly id: string }
) {
  const group =
    action.objectType === undefined
      ? runtime.data
      : Reflect.get(runtime.data, action.objectType)
  // SAFETY: the generated form supplies the installed Action and validates input against its schema.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return operation(group, action.id, "mutationOptions")() as UseMutationOptions<
    unknown,
    unknown,
    Readonly<Record<string, unknown>>
  >
}
