import { Model } from "@company/model"
import { Context, Layer } from "effect"

import { makeObjectRepository } from "@/server/database/model-storage"

export class InteractionRepository extends Context.Service<InteractionRepository>()(
  "@company/InteractionRepository",
  { make: makeObjectRepository(Model.objects.interaction) }
) {
  static readonly layer = Layer.effect(this, this.make)
}
