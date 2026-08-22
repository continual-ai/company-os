# @acme/api

Acme's source-owned, browser-safe business contract.

This package gives Acme's interfaces a shared description of business concepts and capabilities.
It is contract source, not a backend implementation and not an inventory of repository apps.

```ts
import { AcmeModel } from "@acme/api"
```

The example model exercises root and nested objects, interface-backed polymorphic links, and
conventional object reads and CRUD actions. Object definitions live under `src/objects`,
relationship definitions under `src/links`, and `AcmeModel` indexes them
publicly as objects, links, interfaces, and actions. Every object declares its canonical parent
type independently of its business links; for example, a line item is owned by a deal while CRM
associations remain ordinary links.

Each link defines both object-facing traversal keys. The closed `AcmeModel` derives singular ID
properties such as `deal.companyId` and `contact.primaryCompanyId`, keeping object write schemas
and link semantics aligned without defining the same relationship twice.

## Belongs here

- Company-specific objects, properties, links, and public action contracts
- The deliberate composition of the contract Acme exposes
- Metadata that multiple consumers genuinely need to interpret the same business meaning

## Does not belong here

- Handlers, repositories, database clients, secrets, or provider SDKs
- React components, TanStack routes, or application inventory
- Effect-specific or transport-specific behavior that would make the contract unusable by ordinary
  browser consumers

Use public, portable `@continual/runtime` definitions where they help.
