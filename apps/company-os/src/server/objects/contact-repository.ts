import { Model } from "@company/model"
import { Context, Layer } from "effect"

import { makeObjectRepository } from "@/server/database/object-repository"

export class ContactRepository extends Context.Service<ContactRepository>()(
  "@company/ContactRepository",
  {
    make: makeObjectRepository(Model.objects.contact),
  }
) {
  static readonly layer = Layer.effect(this, this.make)
}
