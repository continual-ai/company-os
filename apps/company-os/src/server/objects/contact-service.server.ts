import { AcmeModel } from "@acme/api"
import * as ObjectService from "@continual/runtime/effect/object-service"
import { Context, Effect, Layer } from "effect"

import { Authorization } from "@/server/authorization.server"

import { ContactRepository } from "./contact-repository.server"

const make = Effect.gen(function* () {
  const authorization = yield* Authorization
  const repository = yield* ContactRepository

  return ObjectService.make(AcmeModel.objects.contact, repository, {
    authorize: authorization.require,
  })
})

/** Governed operations for Acme contact objects. */
export class ContactService extends Context.Service<ContactService>()(
  "@acme/ContactService",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
