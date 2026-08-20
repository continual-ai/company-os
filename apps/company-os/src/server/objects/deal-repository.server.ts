import { AcmeModel } from "@acme/api"
import { Context, Layer } from "effect"

import * as ObjectRepository from "@/server/database/object-repository.server"
import { deals } from "@/server/database/schema/deals"

export class DealRepository extends Context.Service<DealRepository>()(
  "@acme/DealRepository",
  { make: ObjectRepository.make(AcmeModel.objects.deal, deals) }
) {
  static readonly layer = Layer.effect(this, this.make)
}
