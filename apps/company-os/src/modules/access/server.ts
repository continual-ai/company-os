import { Effect, Layer } from "effect"

import { AccessModule } from "#/modules/access/model.ts"
import { RoleAssignmentRepository } from "#/modules/access/role-assignment/server/role-assignment-repository.ts"
import { RoleAssignmentService } from "#/modules/access/role-assignment/server/role-assignment-service.ts"
import { ServiceAccountService } from "#/modules/access/service-account/server/service-account-service.ts"
import { UserService } from "#/modules/access/user/server/user-service.ts"
import { defineModuleServer } from "#/server/model/module-server.ts"

export const AccessServer = defineModuleServer(
  AccessModule,
  Effect.gen(function* () {
    const assignments = yield* RoleAssignmentService
    return {
      roleAssignment: {
        create: assignments.create,
        delete: assignments.delete,
      },
    }
  }),
  Layer.mergeAll(
    RoleAssignmentService.layer.pipe(
      Layer.provide(RoleAssignmentRepository.layer)
    ),
    ServiceAccountService.layer,
    UserService.layer
  )
)
