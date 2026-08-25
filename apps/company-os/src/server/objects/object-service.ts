import type { ObjectType } from "@company/runtime"
import type { Repository } from "@company/runtime/effect/object-repository"
import * as ObjectService from "@company/runtime/effect/object-service"
import { Effect } from "effect"

import { Authorization } from "@/server/authorization/authorization-service"
import { makeRecordAliasResolver } from "@/server/database/model-storage"
import { PLATFORM_ID } from "@/system-records"

/** Applies application policy and identity resolution to an object repository. */
export function makeObjectService<
  const TObject extends ObjectType,
  TError,
  TRequirements,
>(
  object: TObject,
  repository: Repository<NoInfer<TObject>, TError, TRequirements>
) {
  return Effect.gen(function* () {
    const authorization = yield* Authorization
    const resolveRecordAliases = yield* makeRecordAliasResolver

    return ObjectService.make(object, repository, {
      authorize: authorization.require,
      rootId: PLATFORM_ID,
      resolveRecordAliases,
      visibleWithin: authorization.visibleWithin,
    })
  })
}
