import { definitionId } from "./identity"
import {
  type InterfaceImplementation,
  type InterfaceImplementationConstraints,
  type InterfaceImplementationInputs,
  type InterfaceImplementationMap,
  bindInterfaceImplementations,
} from "./interface"

export interface RootType<
  TId extends string = string,
  TInterfaces extends Readonly<Record<string, InterfaceImplementation>> =
    Readonly<Record<string, InterfaceImplementation>>,
> {
  readonly id: TId
  readonly interfaces: TInterfaces
  readonly kind: "root"
  readonly name: string
}

/**
 * Defines the one structural root of a portable company model. A root may
 * implement marker interfaces but remains outside ordinary object CRUD.
 */
export function defineRoot<
  const TId extends string,
  const TImplementations extends InterfaceImplementationInputs = [],
>(definition: {
  readonly id: TId
  readonly implements?: TImplementations &
    InterfaceImplementationConstraints<{}, TImplementations>
  readonly name: string
}): RootType<TId, InterfaceImplementationMap<TImplementations>> {
  const definitions = definition.implements ?? []
  // SAFETY: an omitted implementation list corresponds exactly to the
  // generic default []; supplied definitions are preserved and validated.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const interfaces = bindInterfaceImplementations(
    definition.id,
    {},
    definitions
  ) as InterfaceImplementationMap<TImplementations>
  return {
    id: definitionId(definition.id),
    interfaces,
    kind: "root",
    name: definition.name,
  }
}
