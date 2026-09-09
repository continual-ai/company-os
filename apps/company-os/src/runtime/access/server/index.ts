import { Effect, Layer } from "effect"

import { AccessModule } from "#/runtime/access/model/index.ts"
import { RoleAssignmentRepository } from "#/runtime/access/server/role-assignment-repository.ts"
import { RoleAssignmentService } from "#/runtime/access/server/role-assignment-service.ts"
import { ServiceAccountService } from "#/runtime/access/server/service-account-service.ts"
import { UserService } from "#/runtime/access/server/user-service.ts"
import { defineModuleServer } from "#/runtime/server/model/module-server.ts"

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
