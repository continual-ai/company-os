export interface RootType {
  readonly id: "root"
  readonly kind: "root"
  readonly name: "Root"
}

/** The built-in root type of every Company OS object hierarchy. */
export const Root: RootType = {
  id: "root",
  kind: "root",
  name: "Root",
}
