import { Model } from "@company/model"
import { implementModel } from "@company/runtime/effect/model-implementation"
import { Context, Effect, Layer } from "effect"

import { LeadService } from "./objects/lead-service"
import { ObjectRepositories } from "./objects/object-repositories"
import { makeObjectService } from "./objects/object-service"
import { RoleAssignmentService } from "./objects/role-assignment-service"
import { ServiceAccountService } from "./objects/service-account-service"
import { UserService } from "./objects/user-service"

const make = Effect.gen(function* () {
  const repositories = yield* ObjectRepositories
  return implementModel(Model, {
    anonymousActor: yield* makeObjectService(
      Model.objects.anonymousActor,
      repositories.anonymousActor
    ),
    company: yield* makeObjectService(
      Model.objects.company,
      repositories.company
    ),
    contact: yield* makeObjectService(
      Model.objects.contact,
      repositories.contact
    ),
    deal: yield* makeObjectService(Model.objects.deal, repositories.deal),
    group: yield* makeObjectService(Model.objects.group, repositories.group),
    groupMembership: yield* makeObjectService(
      Model.objects.groupMembership,
      repositories.groupMembership
    ),
    interaction: yield* makeObjectService(
      Model.objects.interaction,
      repositories.interaction
    ),
    lead: yield* LeadService,
    lineItem: yield* makeObjectService(
      Model.objects.lineItem,
      repositories.lineItem
    ),
    principalSet: yield* makeObjectService(
      Model.objects.principalSet,
      repositories.principalSet
    ),
    role: yield* makeObjectService(Model.objects.role, repositories.role),
    roleAssignment: yield* RoleAssignmentService,
    serviceAccount: yield* ServiceAccountService,
    user: yield* UserService,
  })
})

/** The application model exhaustively bound to its governed services. */
export class ModelImplementation extends Context.Service<ModelImplementation>()(
  "@company/ModelImplementation",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
