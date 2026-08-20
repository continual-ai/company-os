# @acme/api

Acme's source-owned, browser-safe business contract.

This package gives Acme's interfaces a shared description of business concepts and capabilities.
It is contract source, not a backend implementation and not an inventory of repository apps.

```ts
import { AcmeModel } from "@acme/api"
```

The example model composes Company, Contact, Lead, and Deal objects; explicit Contact–Company and
Deal–Company links; conventional object reads and CRUD actions; and the Lead object’s `qualify`
action. Object definitions live under `src/objects`, relationship definitions under `src/links`,
and `AcmeModel` indexes them publicly as objects, links, and actions. Every object declares its
canonical parent type independently of its business links; the initial CRM objects live directly
under the built-in Root.

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
