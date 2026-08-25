/* oxlint-disable anti-slop/no-reflect-get */
import { Model } from "@company/model"
import {
  modelTypeAccepts,
  type ListRequest,
  type Page,
  type PropertyDefinition,
} from "@company/runtime"

import { companyClient } from "@/company-client"

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

export function clientFor(object: ModelObject): DynamicObjectClient {
  // SAFETY: createClient and this adapter consume the same closed Model, so a
  // collection key always resolves to the corresponding object client.
  // oxlint-disable-next-line anti-slop/no-chained-type-assertions, typescript/no-unsafe-type-assertion
  return Reflect.get(
    companyClient,
    object.collection
  ) as unknown as DynamicObjectClient
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
