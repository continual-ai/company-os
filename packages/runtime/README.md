# @company/runtime

Portable definitions and reusable machinery for describing, implementing, and projecting a Company
OS model. It supplies application-neutral contracts; it does not know the company's model,
database, policies, UI, or deployment.

Model authors normally consume the portable root package through `@company/model`. Server
applications opt into Effect-based schema, execution, HTTP, and MCP projections through explicit
`@company/runtime/effect/*` subpaths so browser-safe consumers do not acquire server dependencies.

## Define a model

```ts
import {
  defineInterface,
  defineModel,
  defineModule,
  defineObject,
  defineRoot,
  schema,
} from "@company/runtime"

const Identity = defineInterface({
  id: "identity",
  name: "Identity",
  pluralName: "Identities",
})

const Root = defineRoot({ id: "root", name: "Root" })

const User = defineObject({
  id: "user",
  collection: "users",
  name: "User",
  pluralName: "Users",
  parent: Root,
  properties: {
    name: schema.string({ label: "Name" }),
  },
  display: { title: "name" },
  implements: [{ interface: Identity }],
})

const Lead = defineObject({
  id: "lead",
  collection: "leads",
  name: "Lead",
  pluralName: "Leads",
  parent: Root,
  properties: {
    name: schema.string({ label: "Name" }),
  },
  display: { title: "name" },
})

export const Model = defineModel({
  actor: Identity,
  modules: [
    defineModule({
      id: "example",
      name: "Example",
      interfaces: [Identity],
      links: [],
      objects: [User, Lead],
    }),
  ],
  name: "Example",
  root: Root,
})
```

The root is the singleton top of the ownership hierarchy. Objects are durable records beneath it.
Interfaces describe polymorphic roles, Links describe bidirectional relationships, Queries read
state, and Actions perform governed operations. See
[Modeling company operations](../../docs/modeling.md) for the complete conceptual guide.

## Bind and project the contract

The central application binds the closed model once to governed object services and custom Action
implementations. The same binding drives HTTP handlers, OpenAPI, typed clients, MCP tools, and model
descriptions. A transport partitions and reconstructs the semantic request mechanically; it does
not authorize callers, implement business rules, or call repositories directly.

`Repository` is the portable persistence contract consumed by object services. An adapter owns the
atomicity and hierarchy guarantees of its storage system. `@company/postgres` supplies the shared
PostgreSQL implementation, while the application owns migrations, credentials, policies, and final
service composition.

The exact public subpaths and dependencies are declared in [`package.json`](package.json). Exact
operation types and invariants are defined by source, TSDoc, and tests rather than duplicated here.

## Boundaries

This package owns:

- application-neutral model and schema definitions with type inference;
- reusable repository and governed object-service contracts;
- mechanical descriptions and projections of a bound model; and
- execution or transport behavior proven common across application slices.

It does not own:

- company-specific nouns, policy, handlers, persistence choices, providers, or UI;
- application migrations, credentials, or runtime configuration;
- independent business implementations for each transport; or
- a hosted-platform requirement.

Read the [architecture guide](../../docs/architecture.md) for the repository-wide dependency and
authority model.

## Develop

From the repository root:

```sh
pnpm turbo run test typecheck --filter=@company/runtime
```
