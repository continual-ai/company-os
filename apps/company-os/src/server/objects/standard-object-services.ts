import { Model } from "@company/model"
import { Context, Effect, Layer } from "effect"

import { CompanyRepository } from "./company-repository"
import { ContactRepository } from "./contact-repository"
import { DealRepository } from "./deal-repository"
import { GroupMembershipRepository } from "./group-membership-repository"
import { GroupRepository } from "./group-repository"
import { InteractionRepository } from "./interaction-repository"
import { LineItemRepository } from "./line-item-repository"
import { makeObjectService } from "./object-service"
import { RoleRepository } from "./role-repository"

const make = Effect.gen(function* () {
  return {
    company: yield* makeObjectService(
      Model.objects.company,
      yield* CompanyRepository
    ),
    contact: yield* makeObjectService(
      Model.objects.contact,
      yield* ContactRepository
    ),
    deal: yield* makeObjectService(Model.objects.deal, yield* DealRepository),
    group: yield* makeObjectService(
      Model.objects.group,
      yield* GroupRepository
    ),
    groupMembership: yield* makeObjectService(
      Model.objects.groupMembership,
      yield* GroupMembershipRepository
    ),
    interaction: yield* makeObjectService(
      Model.objects.interaction,
      yield* InteractionRepository
    ),
    lineItem: yield* makeObjectService(
      Model.objects.lineItem,
      yield* LineItemRepository
    ),
    role: yield* makeObjectService(Model.objects.role, yield* RoleRepository),
  }
})

/** Governed CRUD for objects that do not own additional domain actions. */
export class StandardObjectServices extends Context.Service<StandardObjectServices>()(
  "@company/StandardObjectServices",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
