import { AuthorizationScope } from "#/runtime/model/core/authorization-scope.ts"
import {
  type InterfaceImplementation,
  bindInterfaceImplementations,
} from "#/runtime/model/definition/interface.ts"

export interface RootType {
  readonly id: "root"
  readonly interfaces: {
    readonly authorizationScope: InterfaceImplementation<
      "authorizationScope",
      Readonly<Record<never, never>>
    >
  }
  readonly kind: "root"
  readonly name: string
}

/**
 * The one structural root above every durable record. It is the default
 * `parent`, the outermost authorization scope, and stays outside object CRUD.
 */
export const Root: RootType = {
  id: "root",
  interfaces: bindInterfaceImplementations("root", {}, [
    { interface: AuthorizationScope },
  ]),
  kind: "root",
  name: "Root",
}
