import { AcmeModel } from "@acme/api"
import { Context, Layer } from "effect"

import * as ObjectRepository from "@/server/database/object-repository.server"
import { interactions } from "@/server/database/schema/interactions"

export class InteractionRepository extends Context.Service<InteractionRepository>()(
  "@acme/InteractionRepository",
  { make: ObjectRepository.make(AcmeModel.objects.interaction, interactions) }
) {
  static readonly layer = Layer.effect(this, this.make)
}
