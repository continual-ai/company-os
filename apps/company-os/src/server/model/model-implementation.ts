import { Model } from "@company/model"
import { implementModel } from "@company/runtime/effect/model-implementation"
import { Context, Effect, Layer } from "effect"

import { RoleAssignmentService } from "@/server/modules/access/role-assignment-service"
import { ServiceAccountService } from "@/server/modules/access/service-account-service"
import { UserService } from "@/server/modules/access/user-service"
import { LeadService } from "@/server/modules/sales/lead-service"

import { Links } from "./link-service"
import { ObjectRepositories } from "./object-repositories"
import { makeBaseObjectService, makeObjectService } from "./object-service"

const make = Effect.gen(function* () {
  const repositories = yield* ObjectRepositories
  const links = yield* Links
  return implementModel(
    Model,
    {
      anonymousActor: yield* makeBaseObjectService(
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
      principalSet: yield* makeBaseObjectService(
        Model.objects.principalSet,
        repositories.principalSet
      ),
      role: yield* makeBaseObjectService(Model.objects.role, repositories.role),
      roleAssignment: yield* RoleAssignmentService,
      serviceAccount: yield* ServiceAccountService,
      user: yield* UserService,
    },
    links
  )
})

/** The application model exhaustively bound to its governed services. */
export class ModelImplementation extends Context.Service<ModelImplementation>()(
  "@company/ModelImplementation",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
