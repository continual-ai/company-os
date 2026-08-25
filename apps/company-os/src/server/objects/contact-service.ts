import { Model } from "@company/model"
import { Context, Effect, Layer } from "effect"

import { ContactRepository } from "./contact-repository"
import { makeObjectService } from "./object-service"

const make = Effect.gen(function* () {
  const repository = yield* ContactRepository
  return yield* makeObjectService(Model.objects.contact, repository)
})

/** Governed queries and actions for contact objects. */
export class ContactService extends Context.Service<ContactService>()(
  "@company/ContactService",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
