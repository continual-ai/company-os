import { Effect, Layer } from "effect"

import { AccessModule } from "#/model/access/model.ts"
import { RoleAssignmentRepository } from "#/server/access/role-assignment-repository.ts"
import { RoleAssignmentService } from "#/server/access/role-assignment-service.ts"
import { ServiceAccountService } from "#/server/access/service-account-service.ts"
import { UserService } from "#/server/access/user-service.ts"
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
