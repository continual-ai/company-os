import type {
  LinkTraversal,
  LinkType,
} from "#/runtime/model/definition/link.ts"
import type { ModelRecordSides } from "#/runtime/model/definition/model-record.ts"
import type {
  ModelCatalog,
  ModelObject,
  RecordIdOf,
} from "#/runtime/model/definition/model.ts"
import type {
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

type ModelLinkSide<M extends ModelCatalog, O extends ObjectType> = Exclude<
  ModelRecordSides<M, O>,
  { readonly link: { readonly outputOnly: true } }
>

type InitialLinkValue<
  TModel extends ModelCatalog,
  TTarget extends LinkTraversal,
  TSide extends LinkTraversal,
> = TSide["max"] extends 1
  ?
      | EndpointIdentifier<TModel, TTarget["from"]>
      | (TSide["min"] extends 0 ? null : never)
  : ReadonlyArray<EndpointIdentifier<TModel, TTarget["from"]>>

type RequiredInitialLinks<
  TModel extends ModelCatalog,
  TObject extends ObjectType,
> = {
  readonly [
    TSide in ModelLinkSide<TModel, TObject> as TSide["side"]["min"] extends 0
      ? never
      : TSide["side"]["key"]
  ]: InitialLinkValue<TModel, TSide["target"], TSide["side"]>
}

type OptionalInitialLinks<
  TModel extends ModelCatalog,
  TObject extends ObjectType,
> = {
  readonly [
    TSide in ModelLinkSide<TModel, TObject> as TSide["side"]["min"] extends 0
      ? TSide["side"]["key"]
      : never
  ]?: InitialLinkValue<TModel, TSide["target"], TSide["side"]>
}

type InitialLinksFor<
  TModel extends ModelCatalog,
  TObject extends ObjectType,
> = RequiredInitialLinks<TModel, TObject> &
  OptionalInitialLinks<TModel, TObject>

/** Standard create input plus the object's model-derived initial Links. */
export type ModelObjectCreateInput<
  TModel extends ModelCatalog,
  TObject extends ModelObject<TModel>,
> = ObjectCreateProperties<TObject> &
  (keyof RequiredInitialLinks<TModel, TObject> extends never
    ? { readonly links?: InitialLinksFor<TModel, TObject> }
    : { readonly links: InitialLinksFor<TModel, TObject> })

type LinkChangesFor<
  TModel extends ModelCatalog,
  TTarget extends LinkTraversal,
> = {
  readonly add?: ReadonlyArray<EndpointIdentifier<TModel, TTarget["from"]>>
  readonly remove?: ReadonlyArray<EndpointIdentifier<TModel, TTarget["from"]>>
}

type UpdateLinksFor<TModel extends ModelCatalog, TObject extends ObjectType> = {
  readonly [TSide in ModelLinkSide<TModel, TObject> as TSide["side"]["key"]]?:
    | InitialLinkValue<TModel, TSide["target"], TSide["side"]>
    | (TSide["side"]["max"] extends 1
        ? never
        : LinkChangesFor<TModel, TSide["target"]>)
}

/** Standard update input plus atomic deltas for writable model Links. */
export type ModelObjectUpdateInput<
  TModel extends ModelCatalog,
  TObject extends ModelObject<TModel>,
> = ObjectUpdateInput<TObject> & {
  readonly links?: UpdateLinksFor<TModel, TObject>
}
