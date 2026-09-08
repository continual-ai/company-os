export { defineEvent } from "#/model/definition/event.ts"

export type {
  Action,
  ActionDefinition,
  ActionDefinitions,
  ActionError,
  ActionInput,
  ActionOutput,
  ActionScope,
  StandardActionId,
} from "#/model/definition/action.ts"
export { isStandardActionId } from "#/model/definition/action.ts"
export {
  defineError,
  errorReason,
  errorStatuses,
  isApiError,
  isErrorReason,
} from "#/model/definition/error.ts"
export type {
  ApiError,
  ErrorType,
  ErrorStatus,
} from "#/model/definition/error.ts"
export type {
  InferProperties,
  InferProperty,
  Properties,
  PropertyDefinition,
} from "#/model/definition/property.ts"
export { defineInterface } from "#/model/definition/interface.ts"
export type {
  InterfaceDisplay,
  InterfaceImplementation,
  InterfaceType,
} from "#/model/definition/interface.ts"
export {
  defineModel,
  modelObjectLinkTraversals,
  modelModules,
  modelObjects,
  modelQueries,
  modelTypeAccepts,
} from "#/model/definition/model.ts"
export type {
  Model,
  ModelCatalog,
  ModelEndpointObjectTypeId,
  ModelObject,
  ModelObjectRef,
  ModelLinkTraversal,
  LinkDirection,
  ModelObjectCreateInput,
  ModelObjectUpdateInput,
  RecordIdOf,
} from "#/model/definition/model.ts"
export { defineModule } from "#/model/definition/module.ts"
export type { ModuleDefinition } from "#/model/definition/module.ts"
export { defineLink, linkCardinalities } from "#/model/definition/link.ts"
export type {
  LinkType,
  LinkCardinality,
  LinkEndpoint,
  LinkTraversal,
} from "#/model/definition/link.ts"
export { defineObject, Etag } from "#/model/definition/object.ts"
export type {
  BaseRecord,
  RecordAliasDelta,
  RecordAliasUpdate,
  ObjectBatchDeleteInput,
  ObjectBatchGetInput,
  ObjectDeleteInput,
  ObjectGetInput,
  ObjectType,
  ObjectCreateInput,
  ObjectDisplay,
  ObjectParent,
  ObjectRef,
  ObjectRecord,
  ObjectUpdateInput,
  ObjectWriterUpdateInput,
} from "#/model/definition/object.ts"
export { defineRoot } from "#/model/definition/root.ts"
export type { RootType } from "#/model/definition/root.ts"
export {
  queryKey,
  standardQueries,
  standardQueryIds,
} from "#/model/definition/query.ts"
export type {
  Query,
  CustomQuery,
  QueryDefinition,
  QueryInput,
  QueryOutput,
  QueryScope,
  StandardQueries,
  StandardQueryId,
} from "#/model/definition/query.ts"
export {
  DEFAULT_PAGE_SIZE,
  filterOperators,
  MAX_BATCH_DELETE_SIZE,
  MAX_BATCH_GET_SIZE,
  MAX_PAGE_SIZE,
  normalizePageSize,
  nullPlacements,
  PageToken,
  sortDirections,
} from "#/model/definition/request.ts"
export type {
  Batch,
  FilterOperator,
  ListRequest,
  NullPlacement,
  ObjectFilter,
  ObjectSort,
  Page,
  PageTokenCodec,
  SortDirection,
} from "#/model/definition/request.ts"
export {
  CalendarDate,
  CurrencyCode,
  Decimal,
  DomainName,
  EmailAddress,
  isRecordAlias,
  MAX_RECORD_ALIAS_LENGTH,
  RecordAlias,
  PhoneNumber,
  RecordId,
  schema,
  Timestamp,
  WebUrl,
} from "#/model/definition/schema.ts"
export type {
  AnySchema,
  Choice,
  ChoiceColor,
  DecimalSchema,
  DecimalSchemaOptions,
  FileRef,
  GeoPoint,
  GeoPointSchema,
  ImageRef,
  InferInputSchema,
  InferSchema,
  LiteralValue,
  Money,
  MediaRef,
  MediaSchema,
  NumberSchemaOptions,
  RecordIdentifier,
  SchemaDefinition,
  SchemaAnnotations,
  SchemaProperties,
  StringSchemaOptions,
} from "#/model/definition/schema.ts"
export {
  AbortedError,
  AlreadyExistsError,
  FailedPreconditionError,
  InternalError,
  NotFoundError,
  PermissionDeniedError,
  standardErrorViolations,
  standardErrors,
  UnauthenticatedError,
  ValidationError,
  violationSchema,
} from "#/model/definition/standard-error.ts"
export type { Violation } from "#/model/definition/standard-error.ts"
export {
  describeModel,
  MODEL_DESCRIPTION_VERSION,
} from "#/model/description.ts"
export type {
  ModelDescription,
  ModuleDescription,
} from "#/model/description.ts"
export { lintModelDescription } from "#/model/model-lint.ts"
export type { ModelDiagnostic } from "#/model/model-lint.ts"

export { modelRelationships } from "#/model/definition/relationship.ts"
export type { ModelRelationship } from "#/model/definition/relationship.ts"
