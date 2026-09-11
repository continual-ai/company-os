import { Effect } from "effect"

import { AnonymousActor, ServiceAccount } from "#/runtime/access/model/index.ts"
import {
  ANONYMOUS_ACTOR_ID,
  SYSTEM_SERVICE_ACCOUNT_ID,
} from "#/runtime/model/system-records.ts"
import { currentActorId } from "#/runtime/server/invocation-context.ts"
import { ModelContext } from "#/runtime/server/model-context.ts"
import { makeObjectSeedRepository } from "#/runtime/server/model/object-repositories.ts"
import type { ObjectInsert } from "#/runtime/server/storage/object-repository.ts"
/** Ensures stable attribution identities, including historical anonymous actors. */
export const seedIdentities = Effect.fn("@company/seedIdentities")(
  function* () {
    const { model } = yield* ModelContext
    const actorId = yield* currentActorId
    const anonymousActorRepository =
      yield* makeObjectSeedRepository(AnonymousActor)
    const serviceAccountRepository =
      yield* makeObjectSeedRepository(ServiceAccount)
    const systemServiceAccount = {
      aliases: [],
      metadata: {},
      createdBy: actorId,
      description: `Built-in system identity for ${model.name}.`,
      id: SYSTEM_SERVICE_ACCOUNT_ID,
      name: "System",
      systemManaged: true,
      updatedBy: actorId,
    } satisfies ObjectInsert<typeof ServiceAccount>
    yield* serviceAccountRepository.upsert(systemServiceAccount)

    yield* anonymousActorRepository.upsert({
      aliases: [],
      metadata: {},
      createdBy: actorId,
      id: ANONYMOUS_ACTOR_ID,
      name: "Anonymous",
      systemManaged: true,
      updatedBy: actorId,
    })
  }
)
