import { AcmeModel } from "@acme/api"
import { Context, Effect, Layer } from "effect"

import { ContactRepository } from "./contact-repository.server"
import { makeObjectService } from "./object-service.server"

const make = Effect.gen(function* () {
  const repository = yield* ContactRepository
  return yield* makeObjectService(AcmeModel.objects.contact, repository)
})

/** Governed queries and actions for Acme contact objects. */
export class ContactService extends Context.Service<ContactService>()(
  "@acme/ContactService",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
