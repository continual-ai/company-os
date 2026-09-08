import { createCapabilities } from "@company/runtime/client/capabilities"

import { Model } from "#/app.model.ts"
export const { capabilityPermission } = createCapabilities(Model)
