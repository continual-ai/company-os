import type { LinkTraversal } from "./link"
import { modelObjects, type ModelCatalog } from "./model"

/** One semantic relationship, projected from its single authoritative storage definition. */
export interface ModelRelationship {
  readonly id: string
  readonly forward: LinkTraversal
  readonly reverse: LinkTraversal
  readonly storage:
    | {
        readonly kind: "link"
        readonly linkId: string
        readonly subsetOf?: string
      }
    | {
        readonly kind: "reference"
        readonly objectType: string
        readonly property: string
        readonly onDelete: "restrict"
      }
    | {
        readonly kind: "parent"
        readonly objectType: string
        readonly property: "parent"
        readonly onDelete: "restrict"
      }
}

/** Link and FK relationships share named directions. Parent remains explicitly marked as ownership. */
export function modelRelationships(
  model: ModelCatalog
): ReadonlyArray<ModelRelationship> {
  const links: Array<ModelRelationship> = Object.values(model.links).map(
    (link) => ({
      id: link.id,
      forward: link.forward,
      reverse: link.reverse,
      storage: {
        kind: "link",
        linkId: link.id,
        ...(link.subsetOf === undefined ? {} : { subsetOf: link.subsetOf }),
      },
    })
  )
  const references = modelObjects(model).flatMap((object) => {
    const from = { kind: "object", typeId: object.id } as const
    const fields: Array<ModelRelationship> = Object.entries(
      object.properties
    ).flatMap(([property, definition]) => {
      if (definition.kind !== "recordId") return []
      const to = {
        kind: Object.hasOwn(model.interfaces, definition.typeId)
          ? "interface"
          : "object",
        typeId: definition.typeId,
      } as const
      const inverse = definition.inverse ?? {
        key: `${object.collection}By${property[0]!.toUpperCase()}${property.slice(1)}`,
        label: `${object.pluralName} (${definition.label ?? property})`,
      }
      return [
        {
          id: `${object.id}.${property}`,
          forward: {
            from,
            to,
            key: property,
            label: definition.label ?? property,
            cardinality: definition.nullable ? "zeroOrOne" : "one",
          },
          reverse: { from: to, to: from, ...inverse, cardinality: "many" },
          storage: {
            kind: "reference",
            objectType: object.id,
            property,
            onDelete: "restrict",
          },
        } satisfies ModelRelationship,
      ]
    })
    if (object.parent.kind !== "root") {
      const to = { kind: object.parent.kind, typeId: object.parent.typeId }
      fields.push({
        id: `${object.id}.parent`,
        forward: {
          from,
          to,
          key: "parent",
          label: "Authorization parent",
          cardinality: "one",
        },
        reverse: {
          from: to,
          to: from,
          key: `${object.collection}ByParent`,
          label: `${object.pluralName} (owned)`,
          cardinality: "many",
        },
        storage: {
          kind: "parent",
          objectType: object.id,
          property: "parent",
          onDelete: "restrict",
        },
      })
    }
    return fields
  })
  return [...links, ...references]
}
