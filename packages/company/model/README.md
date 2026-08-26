# @company/model

The browser-safe semantic model that the repository owner can inspect and change.

This package defines the objects, interfaces, links, actions, and shared metadata that give every
interface the same business meaning. It is model source, not a backend implementation, transport
API, or inventory of repository apps.

```ts
import { Model } from "@company/model"
```

## Model metadata

Edit [`src/metadata.ts`](src/metadata.ts) to set the model's display name. Package names and imports
remain stable; each application owns its own name and presentation.

The example model defines `Root` as the structural root of its ownership hierarchy and exercises
both root-level and nested objects, interface-backed polymorphic links, and conventional object
reads and CRUD actions. Definitions live in capability folders under `src/modules`; each
`module.ts` explicitly composes its interfaces, objects, and links. `AccessModule` owns actors,
identity, and authorization definitions, while `SalesModule` owns the starter sales model. `Model`
composes those modules into one validated catalog. Every object declares its canonical parent type
independently of its business links; for example, a line item is owned by a deal while sales
associations remain ordinary links.

Each link defines complete `forward` and `reverse` traversals. The closed `Model` verifies that
their endpoints mirror each other and derives singular relationship properties such as
`deal.company` and `contact.primaryCompany`, keeping object write schemas and link semantics aligned
without making storage orientation part of the authoring API.

## Belongs here

- Objects, properties, links, and public action contracts owned by this repository
- The deliberate composition of the model the repository exposes
- Metadata that multiple consumers genuinely need to interpret the same business meaning

## Does not belong here

- Handlers, repositories, database clients, secrets, or provider SDKs
- React components, TanStack routes, or application inventory
- Effect-specific or transport-specific behavior that would make the contract unusable by ordinary
  browser consumers

Use public, portable `@company/runtime` definitions where they help.
