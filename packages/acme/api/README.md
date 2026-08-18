# @acme/api

Acme's source-owned, browser-safe semantic API contract.

This package names the business concepts shared by the Console, customer software, integrations,
and agents. Define a concept once here so the runtime can derive consistent descriptions, clients,
and protocol surfaces without inventing another business model.

```ts
import { AcmeApi } from "@acme/api"
```

## Belongs here

- Objects and their typed fields, relationships, and display metadata
- Explicit actions, queries, results, errors, and policies as real slices introduce them
- The closed-world `AcmeApi` composition

## Does not belong here

- Handlers, repositories, database clients, secrets, or provider SDKs
- TanStack routes, React components, or app inventory
- Transport-specific business logic

The only runtime dependency is `@continual/runtime`. Private implementations are composed in the
server boundary of `apps/company-os`.

## Current state

`AcmeApi` contains a CRM module with Customer, Contact, and Project objects. Actions, queries, and
policies have not been defined yet.
