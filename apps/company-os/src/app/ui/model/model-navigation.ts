import { presentation } from "#/app/app-presentation.ts"
import { createModelNavigation } from "#/runtime/ui/model/model-navigation.ts"
export const modelNavigation = createModelNavigation(presentation)
export const modelNavigationChecks = modelNavigation.flatMap((module) =>
  module.items.map((item) => item.check)
)
