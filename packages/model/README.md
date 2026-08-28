# @company/model

The browser-safe business contract shared by the operating application, external interfaces, and
agents. It declares objects, interfaces, relationships, queries, actions, and shared metadata
without choosing a backend, transport, or UI.

```ts
import { Model } from "@company/model"
```

`@company/model` depends only on portable definitions from `@company/runtime`. The central Company
OS app supplies authorization, implementations, transactions, persistence, and transports for the
closed `Model`.

## Change the model

Edit [`src/metadata.ts`](src/metadata.ts) to set the model's display name. Package names and imports
remain stable; each application owns its own name and presentation.

Definitions live under `src/modules`. Each module explicitly composes its objects, interfaces, and
Links, and the top-level `Model` composes those modules into one validated catalog. The included
sales module is an example business slice and may be replaced as the repository is adapted.

When persisted shape changes, update the central app implementation and follow the
[database workflow](../../docs/runbooks/database.md).

## Model relationships deliberately

Use `parent` only for durable ownership and authorization hierarchy. Use a record-reference property
for directional state stored inline on one Object. Use a Link for shared bidirectional vocabulary
without independent identity. Use an Object when the relationship has attributes, lifecycle,
history, or distinct authorization.

Do not encode one fact as both a property and a Link. See
[Modeling company operations](../../docs/modeling.md) for the complete decision guide.

## Boundaries

This package owns:

- the business definitions and public operation contracts owned by this repository;
- deliberate composition of the model exposed to every interface; and
- metadata that consumers need to interpret the same business meaning.

It does not own:

- handlers, repositories, database clients, secrets, or provider SDKs;
- React components, TanStack routes, or application inventory; or
- Effect- or transport-specific behavior that would make the contract unsafe for browser consumers.

Read the [architecture guide](../../docs/architecture.md) for how the model fits the complete
request path.

## Develop

From the repository root:

```sh
pnpm --filter @company/model test
pnpm --filter @company/model typecheck
```
