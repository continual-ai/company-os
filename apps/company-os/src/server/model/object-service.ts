import type {
  ModelObjectCreateInput,
  ModelObjectUpdateInput,
  ObjectCreateInput,
  ObjectRecord,
  ObjectUpdateInput,
} from "@company/runtime"
import type { ModelObjectService } from "@company/runtime/effect/model-implementation"
import type { Repository } from "@company/runtime/effect/object-repository"
import * as ObjectService from "@company/runtime/effect/object-service"
import type { CurrentInvocation } from "@company/runtime/effect/object-service"
import type { Model } from "company-os/model"
import { Effect } from "effect"

import { compileAssetReferences } from "@/modules/assets/asset/references"
import { Authorization } from "@/server/authorization/authorization-service"
import { Database } from "@/server/database/database"
import { ROOT_ID } from "@/system-records"

import { Links } from "./link-service"
import { RecordIdentifierResolver } from "./record-identifier-resolver"

type ModelObject = (typeof Model.objects)[keyof typeof Model.objects]
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

/** Derives each enabled operation with application policy and atomic Link coordination. */
export function makeObjectService<
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
    const database = yield* Database
    const links = yield* Links
    const collectAssets = compileAssetReferences(object)
    const requireAssets = (values: Readonly<Record<string, unknown>>) => {
      const ids =
        collectAssets?.(values).map((reference) => reference.assetId) ?? []
      return ids.length === 0
        ? Effect.void
        : authorization.requireOperation({
            objectType: "asset",
            operationId: "get",
            recordIds: ids,
          })
    }
    const governedRepository =
      collectAssets === undefined
        ? repository
        : {
            ...repository,
            insert: (input: Parameters<typeof repository.insert>[0]) =>
              requireAssets(input).pipe(
                Effect.andThen(repository.insert(input))
              ),
            update: (input: Parameters<typeof repository.update>[0]) =>
              requireAssets(input).pipe(
                Effect.andThen(repository.update(input))
              ),
          }
    const base = ObjectService.make(object, governedRepository, {
      authorize: authorization.require,
      rootId: ROOT_ID,
      resolveRecordAliases: identifiers.resolveAliases,
      visibleWithin: authorization.visibleWithin,
    })
    const coordinated: Record<string, unknown> = { ...base }
    if ("create" in base) {
      // SAFETY: the standard factory includes create exactly when enabled by this object.
      const create = base.create as (
        input: ObjectCreateInput<TObject>
      ) => Effect.Effect<
        ObjectRecord<TObject>,
        unknown,
        CurrentInvocation | TRequirements
      >
      coordinated.create = Effect.fn(`${object.id}.create`)(function* (
        input: ModelObjectCreateInput<typeof Model, TObject>
      ) {
        const { links: initialLinks = {}, ...values } = input
        return yield* database.transaction(() =>
          Effect.gen(function* () {
            // SAFETY: the model envelope adds only links to the standard input.
            const record = yield* create(
              // oxlint-disable-next-line typescript/no-unsafe-type-assertion
              values as unknown as ObjectCreateInput<TObject>
            )
            yield* links.initialize(object, record.id, initialLinks)
            return record
          })
        )
      })
    }
    if ("update" in base) {
      // SAFETY: update is selected independently of create by the standard factory.
      const update = base.update as (
        input: ObjectUpdateInput<TObject>
      ) => Effect.Effect<
        ObjectRecord<TObject>,
        unknown,
        CurrentInvocation | TRequirements
      >
      coordinated.update = Effect.fn(`${object.id}.update`)(function* (
        input: ModelObjectUpdateInput<typeof Model, TObject>
      ) {
        const { links: deltas = {}, ...values } = input
        return yield* database.transaction(() =>
          Effect.gen(function* () {
            // SAFETY: the model envelope adds only links to the standard input.
            const record = yield* update(
              // oxlint-disable-next-line typescript/no-unsafe-type-assertion
              values as unknown as ObjectUpdateInput<TObject>
            )
            yield* links.update(object, record.id, deltas)
            return record
          })
        )
      })
    }
    // SAFETY: the operation keys are unchanged; only create/update accept their model Link envelope.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return coordinated as ModelObjectService<typeof Model, TObject, typeof base>
  })
}
