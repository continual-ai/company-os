import type { Effect } from "effect"

import type { ModelClientError } from "#/runtime/client/http-client.ts"
import type {
  ModelQueryOptions,
  ModelInfiniteQueryOptions,
} from "#/runtime/client/model-query-client.ts"
import type { LinkTraversal } from "#/runtime/model/definition/link.ts"
import type {
  ModelRecordSides,
  Expansion,
  ModelExpansion,
} from "#/runtime/model/definition/model-record.ts"
import type {
  ModelEndpointObjectTypeId,
  ModelCatalog,
  ModelObject,
} from "#/runtime/model/definition/model.ts"
import type {
  ObjectRecord,
  ObjectType,
  ObjectGetInput,
  ObjectBatchGetInput,
} from "#/runtime/model/definition/object.ts"
import type {
  ListRequest,
  Page,
  Batch,
} from "#/runtime/model/definition/request.ts"
import type { RecordIdentifier } from "#/runtime/model/definition/schema.ts"

type Result<A, Kind> = Kind extends "promise"
  ? Promise<A>
  : Kind extends "query"
    ? ModelQueryOptions<A, ModelClientError>
    : Effect.Effect<A, ModelClientError>

/** Preserve literal expansion inference through each client projection instead of erasing generic methods. */
type ReadMethod<F, Kind> = Kind extends "query"
  ? { readonly queryOptions: F }
  : F

export interface RecordReads<
  M extends ModelCatalog,
  O extends ObjectType,
  Kind extends "effect" | "promise" | "query",
> {
  readonly get: ReadMethod<
    <const E extends ModelExpansion<M, O> = false>(
      input: ObjectGetInput<O> & { readonly expand?: E }
    ) => Result<ObjectRecord<O, M, E>, Kind>,
    Kind
  >
  readonly list: Kind extends "query"
    ? {
        readonly queryOptions: <const E extends ModelExpansion<M, O> = false>(
          input?: Omit<ListRequest<O>, "expand"> & { readonly expand?: E }
        ) => ModelQueryOptions<Page<ObjectRecord<O, M, E>>, ModelClientError>
        readonly infiniteQueryOptions: <
          const E extends ModelExpansion<M, O> = false,
        >(
          input?: Omit<ListRequest<O>, "expand" | "pageToken"> & {
            readonly expand?: E
          }
        ) => ModelInfiniteQueryOptions<ObjectRecord<O, M, E>, ModelClientError>
      }
    : <const E extends ModelExpansion<M, O> = false>(
        input?: Omit<ListRequest<O>, "expand"> & { readonly expand?: E }
      ) => Result<Page<ObjectRecord<O, M, E>>, Kind>
  readonly batchGet: ReadMethod<
    <const E extends ModelExpansion<M, O> = false>(
      input: ObjectBatchGetInput<O> & { readonly expand?: E }
    ) => Result<Batch<ObjectRecord<O, M, E>>, Kind>,
    Kind
  >
}
export interface PolymorphicReads<
  M extends ModelCatalog,
  Kind extends "effect" | "promise" | "query",
> {
  readonly batchGet: ReadMethod<
    <const E extends Expansion = false>(input: {
      readonly ids: ReadonlyArray<string>
      readonly expand?: E
    }) => Result<
      {
        readonly items: ReadonlyArray<ObjectRecord<ModelObject<M>, M, E>>
        readonly missingIds: ReadonlyArray<string>
      },
      Kind
    >,
    Kind
  >
}

type Target<M extends ModelCatalog, T extends LinkTraversal> = Extract<
  ModelObject<M>,
  { readonly id: ModelEndpointObjectTypeId<M, T["from"]> }
>
export type RelationshipReads<
  M extends ModelCatalog,
  O extends ObjectType,
  Kind extends "effect" | "promise" | "query",
> = {
  readonly [
    S in ModelRecordSides<M, O> as S["side"]["key"]
  ]: S["side"]["max"] extends 1
    ? {
        get: ReadMethod<
          <
            const E extends ModelExpansion<M, Target<M, S["target"]>> = false,
          >(input: {
            readonly id: RecordIdentifier<O["id"]>
            readonly expand?: E
          }) => Result<
            {
              readonly item: ObjectRecord<Target<M, S["target"]>, M, E> | null
            },
            Kind
          >,
          Kind
        >
      }
    : {
        list: Kind extends "query"
          ? {
              queryOptions: <
                const E extends ModelExpansion<M, Target<M, S["target"]>> =
                  false,
              >(
                input: Omit<ListRequest<Target<M, S["target"]>>, "expand"> & {
                  readonly id: RecordIdentifier<O["id"]>
                  readonly expand?: E
                }
              ) => Result<
                Page<ObjectRecord<Target<M, S["target"]>, M, E>>,
                Kind
              >
              infiniteQueryOptions: <
                const E extends ModelExpansion<M, Target<M, S["target"]>> =
                  false,
              >(
                input: Omit<
                  ListRequest<Target<M, S["target"]>>,
                  "expand" | "pageToken"
                > & {
                  readonly id: RecordIdentifier<O["id"]>
                  readonly expand?: E
                }
              ) => ModelInfiniteQueryOptions<
                ObjectRecord<Target<M, S["target"]>, M, E>,
                ModelClientError
              >
            }
          : <const E extends ModelExpansion<M, Target<M, S["target"]>> = false>(
              input: Omit<ListRequest<Target<M, S["target"]>>, "expand"> & {
                readonly id: RecordIdentifier<O["id"]>
                readonly expand?: E
              }
            ) => Result<Page<ObjectRecord<Target<M, S["target"]>, M, E>>, Kind>
      }
}

/** Replace erased generic reads after mapping an Effect client to Promise or query options. */
export type ReadProjection<
  M extends ModelCatalog,
  O extends ObjectType,
  C,
  Kind extends "effect" | "promise" | "query",
> = Omit<C, "get" | "list" | "batchGet" | keyof RelationshipReads<M, O, Kind>> &
  RecordReads<M, O, Kind> & {
    readonly [K in keyof RelationshipReads<M, O, Kind>]: Omit<
      K extends keyof C ? C[K] : never,
      "get" | "list"
    > &
      RelationshipReads<M, O, Kind>[K]
  }
