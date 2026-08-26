/* oxlint-disable anti-slop/no-reflect-get, anti-slop/no-runtime-typeof -- This model adapter validates reflected endpoints before invoking them. */
import { Model } from "@company/model"
import {
  modelTypeAccepts,
  type ListRequest,
  type Page,
  type PropertyDefinition,
} from "@company/runtime"
import { httpEndpointId } from "@company/runtime/effect/http"
import { Effect } from "effect"

import { companyApi } from "@/company-client"

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

export interface DynamicObjectClient {
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
  readonly list: (request?: ListRequest) => Promise<Page<ClientRecord>>
  readonly update?: (
    input: Readonly<Record<string, ClientValue | undefined>> & {
      readonly etag?: string
      readonly id: string
    }
  ) => Promise<ClientRecord>
}

interface NativeEndpointRequest {
  readonly params?: { readonly id: string }
  readonly payload?:
    | ListRequest
    | Readonly<Record<string, ClientValue | undefined>>
    | { readonly ids: ReadonlyArray<string> }
  readonly query?: ListRequest | { readonly etag?: string }
}

type NativeEndpoint = (
  request: NativeEndpointRequest
) => Effect.Effect<unknown, unknown>

type DynamicObjectClientBuilder = {
  -readonly [TKey in keyof DynamicObjectClient]: DynamicObjectClient[TKey]
}

function nativeEndpoint(
  object: ModelObject,
  operation: string
): NativeEndpoint {
  const group = Reflect.get(companyApi, object.id)
  const endpoint = Reflect.get(group, httpEndpointId(operation, object))
  if (typeof endpoint !== "function") {
    throw new Error(`HTTP endpoint '${object.id}.${operation}' is not defined.`)
  }
  // SAFETY: applicationHttpApi and this adapter are projected from the same
  // closed Model; native HttpApiClient owns request encoding and response decoding.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return endpoint as NativeEndpoint
}

async function runEndpoint<TResult>(
  endpoint: NativeEndpoint,
  request: NativeEndpointRequest
): Promise<TResult> {
  // SAFETY: every endpoint result is decoded by its schema in applicationHttpApi.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return Effect.runPromise(endpoint(request)) as Promise<TResult>
}

export function clientFor(object: ModelObject): DynamicObjectClient {
  const list = nativeEndpoint(object, "list")
  const search = nativeEndpoint(object, "search")
  const client: DynamicObjectClientBuilder = {
    list(request = {}) {
      return request.filter === undefined && request.sort === undefined
        ? runEndpoint(list, { query: request })
        : runEndpoint(search, { payload: request })
    },
  }

  if ("batchDelete" in object.actions) {
    const endpoint = nativeEndpoint(object, "batchDelete")
    client.batchDelete = (input) => runEndpoint(endpoint, { payload: input })
  }
  if ("create" in object.actions) {
    const endpoint = nativeEndpoint(object, "create")
    client.create = (input) => runEndpoint(endpoint, { payload: input })
  }
  if ("delete" in object.actions) {
    const endpoint = nativeEndpoint(object, "delete")
    client.delete = ({ etag, id }) =>
      runEndpoint(endpoint, {
        params: { id },
        query: etag === undefined ? {} : { etag },
      })
  }
  if ("update" in object.actions) {
    const endpoint = nativeEndpoint(object, "update")
    client.update = ({ id, ...payload }) =>
      runEndpoint(endpoint, { params: { id }, payload })
  }

  return client
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
