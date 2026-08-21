import { AcmeModel } from "@acme/api"
import { Context, Layer } from "effect"

import * as ObjectRepository from "@/server/database/object-repository.server"
import { contacts } from "@/server/database/schema/contacts"
import { parties } from "@/server/database/schema/parties"

export class ContactRepository extends Context.Service<ContactRepository>()(
  "@acme/ContactRepository",
  {
    make: ObjectRepository.make(AcmeModel.objects.contact, contacts, {
      interfaceTables: [parties],
    }),
  }
) {
  static readonly layer = Layer.effect(this, this.make)
}
