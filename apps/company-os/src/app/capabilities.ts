import { EnabledModel } from "#/app.model.ts"
import { createCapabilities } from "#/runtime/client/capabilities.ts"
export const { capabilityPermission } = createCapabilities(EnabledModel)
