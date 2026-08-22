import { AcmeModel } from "@acme/api"
import { Context, Layer } from "effect"

import { makeObjectRepository } from "@/server/database/model-storage.server"

export class InteractionRepository extends Context.Service<InteractionRepository>()(
  "@acme/InteractionRepository",
  { make: makeObjectRepository(AcmeModel.objects.interaction) }
) {
  static readonly layer = Layer.effect(this, this.make)
}
