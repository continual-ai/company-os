import { Model } from "@company/model"
import { Context, Layer } from "effect"

import { makeObjectRepository } from "@/server/database/object-repository"

export class AnonymousActorRepository extends Context.Service<AnonymousActorRepository>()(
  "@company/AnonymousActorRepository",
  { make: makeObjectRepository(Model.objects.anonymousActor) }
) {
  static readonly layer = Layer.effect(this, this.make)
}
