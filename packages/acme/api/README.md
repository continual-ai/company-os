# @acme/api

Acme's source-owned, browser-safe semantic API contract.

This package names the business concepts shared by the Console, customer software, integrations,
and agents. Define a concept once here so the runtime can derive consistent descriptions, clients,
and protocol surfaces without inventing another business model.

```ts
import { AcmeApi } from "@acme/api"
import { createClient } from "@continual/runtime/client"

const client = createClient(AcmeApi)

await client.companies.list()
await client.leads.qualify(leadId)
```

## Belongs here

- Objects and their typed fields, relationships, and display metadata
- Explicit actions, queries, results, errors, and policies as real slices introduce them
- The closed-world `AcmeApi` composition

## Does not belong here

- Handlers, repositories, database clients, secrets, or provider SDKs
- TanStack routes, React components, or app inventory
- Transport-specific business logic

The only runtime dependency is the portable root API of `@continual/runtime`. Acme definitions do
not import Effect; private implementations and Effect projections are composed in the server
boundary of `apps/company-os`. Consumers can infer their collection-scoped client directly from
`AcmeApi`; modules do not become client namespaces.

## Current state

`AcmeApi` contains a CRM module with Company, Contact, Lead, and Deal objects plus a typed
`qualifyLead` custom action contract. The objects expose create, get, list, update, delete, and
batch-get operations by default. `qualifyLead` declares only the custom, idempotent `qualify` verb;
deal creation remains the standard create operation on deals. Company logos and contact photos use
portable image references, while email, domain, URL, money, and date fields retain their semantic
types. Record shapes are total and non-nullable by default: textual fields use their empty zero
value, while images, references, money, and dates opt into nullability where absence is meaningful.
Queries, policies, handlers, persistence, asset delivery, and generalized associations have not
been defined yet.
