import type { Controller } from "#/runtime/model/definition/controller.ts"
import type { LinkType } from "#/runtime/model/definition/link.ts"
import type { ObjectType } from "#/runtime/model/definition/object.ts"

export interface ControllerWatchStep {
  readonly link: LinkType
  readonly direction: "forward" | "reverse"
}

/** Resolve against the composed model: links need not live beside their source object. */
export function controllerWatchPaths(
  model: {
    readonly objects: ReadonlyArray<ObjectType>
    readonly links: ReadonlyArray<LinkType>
  },
  controller: Controller
): ReadonlyArray<ReadonlyArray<ControllerWatchStep>> {
  return controller.watch.map((path) => {
    let typeId = controller.objectType
    return path.split(".").map((key) => {
      const object = model.objects.find((candidate) => candidate.id === typeId)
      const matches = model.links.flatMap((link) =>
        (["forward", "reverse"] as const).flatMap((direction) => {
          const traversal = link[direction]
          return traversal.key === key &&
            (traversal.from.typeId === typeId ||
              (object !== undefined &&
                Object.hasOwn(object.interfaces, traversal.from.typeId)))
            ? [{ link, direction }]
            : []
        })
      )
      if (matches.length !== 1)
        throw new Error(
          `Controller '${controller.id}' watch '${path}' must resolve '${typeId}.${key}' to exactly one link.`
        )
      const step = matches[0]!
      typeId = step.link[step.direction].to.typeId
      return step
    })
  })
}
