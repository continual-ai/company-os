import "@/old-alias"
import "#root"
import "./nested/child"
import "../parent"
import "./sibling.ts"
import "#/nested/no-extension"
export { value } from "./nested/export"
void import("@/dynamic")
export type Invalid = import("#modules/types").Invalid
