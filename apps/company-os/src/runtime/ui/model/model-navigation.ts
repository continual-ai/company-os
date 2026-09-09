import { objectIcon } from "#/runtime/ui/model/object-icon.ts"
import { objectHref } from "#/runtime/ui/model/object-routing.ts"
import type { ModelUiRuntime } from "#/runtime/ui/model/runtime-context.tsx"

/** Sidebar and home share the same module-owned destinations. */
export function createModelNavigation(runtime: ModelUiRuntime) {
  return Object.values(runtime.model.modules)
    .map((module) => ({
      id: module.id,
      name: module.name,
      items: module.objects
        .flatMap((definition) => {
          const object = Object.values(runtime.model.objects).find(
            (candidate) => candidate.id === definition.id
          )!
          const navigation = runtime.ui[object.id]?.navigation
          if (navigation?.hidden) return []
          return [
            {
              object,
              label: object.pluralName,
              description: navigation?.description ?? object.description,
              icon: navigation?.icon ?? objectIcon(object.display.icon),
              order: navigation?.order ?? 100,
              to: objectHref(runtime, object),
              check: {
                permission: runtime.permissions.capabilityPermission(
                  `${object.id}.list`
                ),
              },
            },
          ]
        })
        .sort((a, b) => a.order - b.order),
    }))
    .filter((module) => module.items.length > 0)
}

/** The advisory list checks behind every navigation destination, preloadable outside React. */
export function modelNavigationChecks(
  navigation: ReturnType<typeof createModelNavigation>
) {
  return navigation.flatMap((module) => module.items.map((item) => item.check))
}
