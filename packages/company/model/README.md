# @company/model

The source-owned, browser-safe semantic model.

This package defines the objects, interfaces, links, actions, and shared metadata that give every
interface the same business meaning. It is model source, not a backend implementation, transport
API, or inventory of repository apps.

```ts
import { Model } from "@company/model"
```

## Model metadata

Edit [`src/metadata.ts`](src/metadata.ts) to set the model's display name. Model identifiers,
package names, folder names, and imports remain stable. Each app owns its own name and presentation.

The example model defines `Platform` as the semantic root of its ownership hierarchy and exercises
both platform-level and nested objects, interface-backed polymorphic links, and conventional object
reads and CRUD actions. Object definitions live under `src/objects`, relationship definitions under
`src/links`, and `Model` indexes them publicly as objects, links, interfaces, and actions. Every
object declares its canonical parent type independently of its business links; for example, a line
item is owned by a deal while CRM associations remain ordinary links.

Each link defines complete `forward` and `reverse` traversals. The closed `Model` verifies that
their endpoints mirror each other and derives singular relationship properties such as
`deal.company` and `contact.primaryCompany`, keeping object write schemas and link semantics aligned
without making storage orientation part of the authoring API.

## Belongs here

- Source-owned objects, properties, links, and public action contracts
- The deliberate composition of the model the repository exposes
- Metadata that multiple consumers genuinely need to interpret the same business meaning

## Does not belong here

- Handlers, repositories, database clients, secrets, or provider SDKs
- React components, TanStack routes, or application inventory
- Effect-specific or transport-specific behavior that would make the contract unusable by ordinary
  browser consumers

Use public, portable `@company/runtime` definitions where they help.
