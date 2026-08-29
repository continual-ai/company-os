import type { Model } from "@company/model"
import type {
  ModelObjectCreateInput,
  ModelObjectUpdateInput,
  ObjectCreateInput,
  ObjectRecord,
  ObjectUpdateInput,
} from "@company/runtime"
import type { Repository } from "@company/runtime/effect/object-repository"
import * as ObjectService from "@company/runtime/effect/object-service"
import type { CurrentInvocation } from "@company/runtime/effect/object-service"
import { Effect } from "effect"

import { Authorization } from "@/server/authorization/authorization-service"
import { Database } from "@/server/database/database"
import { ROOT_ID } from "@/system-records"

import { Links } from "./link-service"
import { RecordIdentifierResolver } from "./record-identifier-resolver"

type ModelObject = (typeof Model.objects)[keyof typeof Model.objects]
type CreatableModelObject = {
  [
    TKey in keyof typeof Model.objects
  ]: "create" extends keyof (typeof Model.objects)[TKey]["actions"]
    ? (typeof Model.objects)[TKey]
    : never
}[keyof typeof Model.objects]

type MutableModelObject = {
  [
    TKey in keyof typeof Model.objects
  ]: "update" extends keyof (typeof Model.objects)[TKey]["actions"]
    ? (typeof Model.objects)[TKey]
    : never
}[keyof typeof Model.objects] &
  CreatableModelObject

/** Validated server-internal writes for custom Actions and trusted adapters. */
export function makeObjectWriter<
  const TObject extends ModelObject,
  TError,
  TRequirements,
>(
  object: TObject,
  repository: Repository<NoInfer<TObject>, TError, TRequirements>
) {
  return Effect.gen(function* () {
    const identifiers = yield* RecordIdentifierResolver
    return ObjectService.makeWriter(object, repository, {
      rootId: ROOT_ID,
      resolveRecordAliases: identifiers.resolveAliases,
    })
  })
}

/** Applies application policy and identity resolution without create coordination. */
export function makeBaseObjectService<
  const TObject extends ModelObject,
  TError,
  TRequirements,
>(
  object: TObject,
  repository: Repository<NoInfer<TObject>, TError, TRequirements>
) {
  return Effect.gen(function* () {
    const authorization = yield* Authorization
    const identifiers = yield* RecordIdentifierResolver
    return ObjectService.make(object, repository, {
      authorize: authorization.require,
      rootId: ROOT_ID,
      resolveRecordAliases: identifiers.resolveAliases,
      visibleWithin: authorization.visibleWithin,
    })
  })
}

/** Adds atomic initial-Link coordination to a creatable object service. */
export function makeObjectService<
  const TObject extends CreatableModelObject,
  TError,
  TRequirements,
>(
  object: TObject,
  repository: Repository<NoInfer<TObject>, TError, TRequirements>
) {
  return Effect.gen(function* () {
    const database = yield* Database
    const links = yield* Links
    const base = yield* makeBaseObjectService(object, repository)
    // SAFETY: CreatableModelObject is exactly the closed-model union whose
    // action registry contains the standard create action.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const creatable = base as unknown as {
      readonly create: (
        input: ObjectCreateInput<TObject>
      ) => Effect.Effect<
        ObjectRecord<TObject>,
        unknown,
        CurrentInvocation | TRequirements
      >
    }
    const baseCreate = creatable.create
    const create = Effect.fn(`${object.id}.create`)(function* (
      input: ModelObjectCreateInput<typeof Model, TObject>
    ) {
      const { links: initialLinks = {}, ...objectInput } = input
      return yield* database.transaction(() =>
        Effect.gen(function* () {
          // SAFETY: ModelObjectCreateInput adds only the model-derived `links`
          // envelope to this exact object's standard create input.
          const record = yield* baseCreate(
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion
            objectInput as unknown as ObjectCreateInput<TObject>
          )
          yield* links.initialize(object, record.id, initialLinks)
          return record
        })
      )
    })

    return { ...base, create }
  })
}

/** Adds atomic Link-delta coordination to a standard mutable object service. */
export function makeMutableObjectService<
  const TObject extends MutableModelObject,
  TError,
  TRequirements,
>(
  object: TObject,
  repository: Repository<NoInfer<TObject>, TError, TRequirements>
) {
  return Effect.gen(function* () {
    const database = yield* Database
    const links = yield* Links
    const service = yield* makeObjectService(object, repository)
    // SAFETY: MutableModelObject is exactly the closed-model union whose
    // action registry contains the standard update action.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const mutable = service as unknown as {
      readonly update: (
        input: ObjectUpdateInput<TObject>
      ) => Effect.Effect<
        ObjectRecord<TObject>,
        unknown,
        CurrentInvocation | TRequirements
      >
    }
    const baseUpdate = mutable.update
    const update = Effect.fn(`${object.id}.update`)(function* (
      input: ModelObjectUpdateInput<typeof Model, TObject>
    ) {
      const { links: linkUpdates = {}, ...objectInput } = input
      return yield* database.transaction(() =>
        Effect.gen(function* () {
          // SAFETY: ModelObjectUpdateInput adds only the model-derived `links`
          // envelope to this exact object's standard update input.
          const record = yield* baseUpdate(
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion
            objectInput as unknown as ObjectUpdateInput<TObject>
          )
          yield* links.update(object, record.id, linkUpdates)
          return record
        })
      )
    })

    return { ...service, update }
  })
}
