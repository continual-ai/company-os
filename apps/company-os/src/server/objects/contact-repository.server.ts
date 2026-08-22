import { AcmeModel } from "@acme/api"
import { Context, Layer } from "effect"

import { makeObjectRepository } from "@/server/database/model-storage.server"

export class ContactRepository extends Context.Service<ContactRepository>()(
  "@acme/ContactRepository",
  {
    make: makeObjectRepository(AcmeModel.objects.contact),
  }
) {
  static readonly layer = Layer.effect(this, this.make)
}
