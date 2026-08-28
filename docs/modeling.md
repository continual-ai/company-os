# Modeling company operations

`@company/model` is the browser-safe source of business meaning. It declares the vocabulary that
the operating application, generated interfaces, integrations, and agents share. Implementations,
authorization, persistence, and provider configuration remain in the central application.

The code and tests are authoritative for exact types. This guide explains how the concepts fit
together when changing the model.

## Core definitions

- A **Model** is the validated catalog exposed by one Company OS installation.
- A **Module** groups related definitions for composition without becoming a separate runtime or
  source of authority. Applications may use its metadata to organize interfaces.
- The **Root** is the singleton structural owner at the top of the model hierarchy.
- An **Object** is a durable business or operational record with identity, lifecycle, and policy.
- An **Interface** names a polymorphic role shared by multiple object types.
- A **Property** is schema-declared data stored on an object, interface, or structured action value.
- A **Query** reads model state without changing it.
- An **Action** is a governed operation that may change state or perform business behavior.

Objects receive standard reads and enabled CRUD actions from the runtime. Add a custom Action for a
business transition or invariant that ordinary object operations cannot express. Its server
implementation owns authorization, transaction boundaries, failure behavior, and consequential
effects.

## Choose one relationship representation

| Need                                                                          | Model it as                            |
| ----------------------------------------------------------------------------- | -------------------------------------- |
| Durable ownership and authorization inheritance                               | `parent`                               |
| Directional state stored inline on one record                                 | A record-reference property            |
| Shared bidirectional vocabulary without independent identity                  | A Link                                 |
| Attributes, lifecycle, history, or distinct authorization on the relationship | An Object referencing its participants |

Do not represent the same fact as both a property and a Link. Declare exact cardinality only when
services, storage, deletion behavior, and tests preserve it.

Each object declares its canonical parent independently of its business relationships. Creates
directly beneath the model root use the application's configured root record; nested creates supply
their parent. Links define both traversal directions so storage orientation does not leak into the
business contract.

## Properties and invariants

Use the portable schema vocabulary for object properties and action inputs and outputs. A writable
property is required on create unless it is nullable or has a default. Output-only properties come
from the implementation and are never accepted from callers.

Use `uniqueBy` for durable record identity rules that storage must enforce transactionally. Link
cardinality owns edge uniqueness; do not restate the same relationship invariant in `uniqueBy`.

Public record-reference properties use the relationship noun, such as `company` or `principal`,
rather than an `Id` suffix. Physical storage may use names such as `company_id` where distinguishing
the stored scalar is useful.

Every record has one canonical ID and may have qualified aliases for identifiers from external
systems. Public operations may locate a record by either form, but repositories, stored references,
events, and returned relationships use canonical IDs.

## Definitions versus implementations

The model declares what callers can understand and invoke. The central app supplies how those
operations execute:

- object services validate values, resolve identifiers, authorize callers, and supply audit context;
- custom action services coordinate domain behavior and transactions;
- repositories preserve persistence, concurrency, and atomicity invariants; and
- HTTP, OpenAPI, clients, and MCP project the same bound implementation.

Keep Effect, repositories, handlers, database clients, secrets, provider SDKs, and React components
out of `@company/model`. Use portable `@company/runtime` definitions where they support the shared
contract.

## Work on the model

Model definitions live under `packages/model/src/modules`. The included sales module is an example
business slice and can be replaced. After changing the model, update its governed implementation
and persistence projection in the central app, then run:

```sh
pnpm --filter @company/model test
pnpm check
pnpm test
```

Follow the [database workflow](runbooks/database.md) when the persisted shape changes.
