import type {
  LinkTraversal,
  LinkType,
} from "#/runtime/model/definition/link.ts"
import type {
  ModelCatalog,
  ModelEndpointObjectTypeId,
  ModelObject,
} from "#/runtime/model/definition/model.ts"
import type {
  ObjectRecord,
  ObjectType,
} from "#/runtime/model/definition/object.ts"
import type { RecordId } from "#/runtime/model/definition/schema.ts"

/** One hop only. Plural expansion hydrates the bounded preview, never the entire set. */
export type Expansion = boolean | Readonly<Record<string, true>>

type Matches<
  O extends ObjectType,
  E extends LinkTraversal["from"],
> = E["kind"] extends "object"
  ? E["typeId"] extends O["id"]
    ? true
    : false
  : E["typeId"] extends keyof O["interfaces"]
    ? true
    : false

type Side<O extends ObjectType, L> = L extends LinkType
  ?
      | (Matches<O, L["forward"]["from"]> extends true
          ? { link: L; side: L["forward"]; target: L["reverse"] }
          : never)
      | (Matches<O, L["reverse"]["from"]> extends true
          ? { link: L; side: L["reverse"]; target: L["forward"] }
          : never)
  : never
export type ModelRecordSides<
  M extends ModelCatalog,
  O extends ObjectType,
> = Side<O, M["links"][keyof M["links"]]>
export type ModelExpansion<M extends ModelCatalog, O extends ObjectType> =
  | boolean
  | {
      readonly [S in ModelRecordSides<M, O> as S["side"]["key"]]?: true
    }
type Target<M extends ModelCatalog, E extends LinkTraversal> = Extract<
  ModelObject<M>,
  { readonly id: ModelEndpointObjectTypeId<M, E["from"]> }
>
type Raw<
  M extends ModelCatalog,
  S extends LinkTraversal,
  T extends LinkTraversal,
> = S["max"] extends 1
  ? RecordId<Target<M, T>["id"]> | null
  : {
      readonly ids: ReadonlyArray<RecordId<Target<M, T>["id"]>>
      readonly totalSize: number
    }
type Expanded<
  M extends ModelCatalog,
  S extends LinkTraversal,
  T extends LinkTraversal,
> = S["max"] extends 1
  ? ModelRecord<M, Target<M, T>> | null
  : {
      readonly items: ReadonlyArray<ModelRecord<M, Target<M, T>>>
      readonly totalSize: number
    }
type Value<
  M extends ModelCatalog,
  S extends LinkTraversal,
  T extends LinkTraversal,
  E,
> = E extends true
  ? Expanded<M, S, T>
  : E extends object
    ? S["key"] extends keyof E
      ? E[S["key"]] extends true
        ? Expanded<M, S, T>
        : Raw<M, S, T> | Expanded<M, S, T>
      : Raw<M, S, T>
    : Raw<M, S, T>

/** Complete record with relationships inferred from the composed model and literal expansion request. */
export type ModelRecord<
  M extends ModelCatalog,
  O extends ObjectType,
  E = undefined,
> = O extends ObjectType
  ? Omit<ObjectRecord<O>, "links"> & {
      readonly links: {
        readonly [S in ModelRecordSides<M, O> as S["side"]["key"]]: Value<
          M,
          S["side"],
          S["target"],
          E
        >
      }
    }
  : never
