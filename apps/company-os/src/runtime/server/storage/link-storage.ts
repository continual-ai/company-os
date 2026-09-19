import { linkReferenceSide } from "#/runtime/model/definition/link.ts"
import type { LinkType, ModelCatalog } from "#/runtime/model/index.ts"
import { snakeCase } from "#/runtime/server/storage/table.ts"

interface ForeignKeyLink {
  readonly kind: "foreignKey"
  readonly side: "forward" | "reverse"
  readonly ownerType: string
  readonly targetType: string
  readonly column: string
}
export type LinkStorage = ForeignKeyLink | { readonly kind: "join" }

/** Store singular references on the owning object or interface table. */
export function linkStorage(link: LinkType): LinkStorage {
  const side = linkReferenceSide(link)
  if (side === undefined) return { kind: "join" }
  const end = link[side]
  return {
    kind: "foreignKey",
    side,
    ownerType: end.from.typeId,
    targetType: end.to.typeId,
    column: `${snakeCase(end.key)}_id`,
  }
}

export function foreignKeys(model: ModelCatalog, typeId: string) {
  return Object.values(model.links).flatMap((link) => {
    const storage = linkStorage(link)
    return storage.kind === "foreignKey" && storage.ownerType === typeId
      ? [{ link, storage }]
      : []
  })
}
