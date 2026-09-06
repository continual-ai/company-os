import { Effect, Layer } from "effect"

import { defineModuleServer } from "@/server/model/module-server"

import { AccessModule } from "./model"
import { RoleAssignmentRepository } from "./role-assignment/server/role-assignment-repository"
import { RoleAssignmentService } from "./role-assignment/server/role-assignment-service"
import { ServiceAccountService } from "./service-account/server/service-account-service"
import { UserService } from "./user/server/user-service"

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
