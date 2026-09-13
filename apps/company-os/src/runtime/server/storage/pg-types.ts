import { types, type CustomTypesConfig } from "pg"

// node-postgres accepts all PostgreSQL OIDs; its TypeId enum omits array types.
// oxlint-disable-next-line typescript/no-unsafe-type-assertion
const textArrayOid = 1009 as Parameters<typeof types.getTypeParser>[0]
const parseTextArray: (value: string) => ReadonlyArray<string | null> =
  types.getTypeParser(textArrayOid, "text")

/** Preserve PostgreSQL microseconds while normalizing the timezone; Date alone truncates them. */
function timestamp(value: string): string {
  const iso = new Date(value).toISOString()
  const fraction = /\.(\d+)(?:[+-]|$)/.exec(value)?.[1] ?? ""
  return fraction.length > 3 ? `${iso.slice(0, -1)}${fraction.slice(3)}Z` : iso
}

/** Match portable model values at the driver boundary; nested JSON stays untouched. */
export const pgTypes: CustomTypesConfig = {
  getTypeParser: (oid, format) => {
    const typeId: number = oid
    if (format === "binary") return types.getTypeParser(oid, format)
    switch (typeId) {
      case 1184:
        return timestamp
      case 1082:
        return (value: string) => value
      case 1182: // date[]
      case 1231: // numeric[] must retain decimal precision
        return parseTextArray
      case 1185:
        return (value: string) =>
          parseTextArray(value).map((item) =>
            item === null ? null : timestamp(item)
          )
      case 17:
        return (value: string) =>
          new Uint8Array(types.getTypeParser(oid, "text")(value))
      case 20:
        return (value: string) => BigInt(value)
      default:
        return types.getTypeParser(oid, format)
    }
  },
}
