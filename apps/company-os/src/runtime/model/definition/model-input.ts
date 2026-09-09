import type {
  LinkTraversal,
  LinkType,
} from "#/runtime/model/definition/link.ts"
import type {
  ModelCatalog,
  ModelObject,
  RecordIdOf,
} from "#/runtime/model/definition/model.ts"
import type {
  ObjectCreateInput,
  ObjectCreateProperties,
  ObjectType,
  ObjectUpdateInput,
} from "#/runtime/model/definition/object.ts"
import type {
  RecordAlias,
  RecordIdentifier,
} from "#/runtime/model/definition/schema.ts"

type EndpointIdentifier<
  TModel extends ModelCatalog,
  TEndpoint extends LinkType["forward"]["from"],
> = TEndpoint["kind"] extends "interface"
  ? TEndpoint["typeId"] extends keyof TModel["interfaces"] & string
    ?
        | RecordIdOf<TModel, TModel["interfaces"][TEndpoint["typeId"]]>
        | RecordAlias
    : never
  : RecordIdentifier<TEndpoint["typeId"]>

type ObjectAcceptsEndpoint<
  TObject extends ObjectType,
  TEndpoint extends LinkType["forward"]["from"],
> = TEndpoint["kind"] extends "object"
  ? TEndpoint["typeId"] extends TObject["id"]
    ? true
    : false
  : TEndpoint["typeId"] extends keyof TObject["interfaces"]
    ? true
    : false

type LinkSideForObject<
  TObject extends ObjectType,
  TLink,
> = TLink extends LinkType
  ?
      | (ObjectAcceptsEndpoint<TObject, TLink["forward"]["from"]> extends true
          ? {
              readonly link: TLink
              readonly side: TLink["forward"]
              readonly target: TLink["reverse"]
            }
          : never)
      | (ObjectAcceptsEndpoint<TObject, TLink["reverse"]["from"]> extends true
          ? {
              readonly link: TLink
              readonly side: TLink["reverse"]
              readonly target: TLink["forward"]
            }
          : never)
  : never

type ModelLinkSide<
  TModel extends ModelCatalog,
  TObject extends ObjectType,
> = TModel["links"][keyof TModel["links"]] extends infer TLink
  ? LinkSideForObject<TObject, TLink>
  : never

type InitialLinkValue<
  TModel extends ModelCatalog,
  TSide extends LinkTraversal,
  TTarget extends LinkTraversal,
> = TSide["cardinality"] extends "many"
  ? ReadonlyArray<EndpointIdentifier<TModel, TTarget["from"]>>
  : EndpointIdentifier<TModel, TTarget["from"]>

type RequiredInitialLinks<
  TModel extends ModelCatalog,
  TObject extends ObjectType,
> = {
  readonly [
    TSide in ModelLinkSide<
      TModel,
      TObject
    > as TSide["side"]["cardinality"] extends "one"
      ? TSide["side"]["key"]
      : never
  ]: InitialLinkValue<TModel, TSide["side"], TSide["target"]>
}

type OptionalInitialLinks<
  TModel extends ModelCatalog,
  TObject extends ObjectType,
> = {
  readonly [
    TSide in ModelLinkSide<
      TModel,
      TObject
    > as TSide["side"]["cardinality"] extends "one"
      ? never
      : TSide["side"]["key"]
  ]?: InitialLinkValue<TModel, TSide["side"], TSide["target"]>
}

type InitialLinksFor<
  TModel extends ModelCatalog,
  TObject extends ObjectType,
> = RequiredInitialLinks<TModel, TObject> &
  OptionalInitialLinks<TModel, TObject>

/** Parent identifier narrowed to the model's implementers when the parent is an interface. */
type ModelCreateParent<
  TModel extends ModelCatalog,
  TObject extends ObjectType,
> = TObject["parent"]["kind"] extends "interface"
  ? TObject["parent"]["typeId"] extends keyof TModel["interfaces"] & string
    ? {
        readonly parent:
          | RecordIdOf<
              TModel,
              TModel["interfaces"][TObject["parent"]["typeId"]]
            >
          | RecordAlias
      }
    : never
  : Pick<ObjectCreateInput<TObject>, "parent">

/** Standard create input plus the object's model-derived initial Links. */
export type ModelObjectCreateInput<
  TModel extends ModelCatalog,
  TObject extends ModelObject<TModel>,
> = ObjectCreateProperties<TObject> &
  ModelCreateParent<TModel, TObject> &
  (keyof RequiredInitialLinks<TModel, TObject> extends never
    ? { readonly links?: InitialLinksFor<TModel, TObject> }
    : { readonly links: InitialLinksFor<TModel, TObject> })

type WritableLinkSide<TSide> = TSide extends {
  readonly link: infer TLink extends LinkType
  readonly side: infer TTraversal extends LinkTraversal
}
  ? TLink["writeFrom"] extends TTraversal["key"]
    ? TSide
    : never
  : never

type CanUnlink<
  TSide extends LinkTraversal,
  TTarget extends LinkTraversal,
> = TSide["cardinality"] extends "one"
  ? false
  : TTarget["cardinality"] extends "one"
    ? false
    : true

type LinkChangesFor<
  TModel extends ModelCatalog,
  TSide extends LinkTraversal,
  TTarget extends LinkTraversal,
> = {
  readonly add?: ReadonlyArray<EndpointIdentifier<TModel, TTarget["from"]>>
} & (CanUnlink<TSide, TTarget> extends true
  ? {
      readonly remove?: ReadonlyArray<
        EndpointIdentifier<TModel, TTarget["from"]>
      >
    }
  : object)

type UpdateLinksFor<TModel extends ModelCatalog, TObject extends ObjectType> = {
  readonly [
    TSide in WritableLinkSide<
      ModelLinkSide<TModel, TObject>
    > as TSide["side"]["key"]
  ]?: LinkChangesFor<TModel, TSide["side"], TSide["target"]>
}

/** Standard update input plus atomic deltas for writable model Links. */
export type ModelObjectUpdateInput<
  TModel extends ModelCatalog,
  TObject extends ModelObject<TModel>,
> = ObjectUpdateInput<TObject> & {
  readonly links?: UpdateLinksFor<TModel, TObject>
}
