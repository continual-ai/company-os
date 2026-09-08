import { createModelNavigation } from "@company/runtime/ui/model/model-navigation"

import { presentation } from "#/app-presentation.ts"
export const modelNavigation = createModelNavigation(presentation)
export const modelNavigationChecks = modelNavigation.flatMap((module) =>
  module.items.map((item) => item.check)
)
