/** Structural root and default parent of durable records; outside object CRUD. */
export interface RootType {
  readonly id: "root"
  readonly interfaces: Readonly<Record<never, never>>
  readonly kind: "root"
  readonly name: string
}
export const Root: RootType = {
  id: "root",
  interfaces: {},
  kind: "root",
  name: "Root",
}
