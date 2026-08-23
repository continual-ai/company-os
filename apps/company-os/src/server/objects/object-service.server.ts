import type { ObjectType } from "@continual/runtime"
import type { Repository } from "@continual/runtime/effect/object-repository"
import * as ObjectService from "@continual/runtime/effect/object-service"
import { Effect } from "effect"

import { Authorization } from "@/server/authorization.server"
import { makeRecordAliasResolver } from "@/server/database/model-storage.server"

/** Applies Acme's shared policy and identity resolution to an object repository. */
export function makeObjectService<
  const TObject extends ObjectType,
  TError,
  TRequirements,
>(object: TObject, repository: Repository<TObject, TError, TRequirements>) {
  return Effect.gen(function* () {
    const authorization = yield* Authorization
    const resolveRecordAlias = yield* makeRecordAliasResolver

    return ObjectService.make(object, repository, {
      authorize: authorization.require,
      resolveRecordAlias,
    })
  })
}
