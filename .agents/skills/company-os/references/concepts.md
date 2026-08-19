# Company OS concepts

> Draft working model. Challenge these concepts when a simpler or more useful product model better
> fits the business and update this reference after a direction is accepted or proven.

## Product model

A Company OS is the source-owned software a company runs on. It unifies the business model behind
customer-facing software, internal operations, APIs, and agents so those interfaces do not diverge
into separate authorities.

The operating model is the shared business meaning: objects, relationships, rules, tools,
permissions, knowledge, metrics, and recurring operations. The backend is the technical system
that stores and enforces that model and publishes governed capabilities to apps and agents.

Use this progression:

```text
define intent -> operate -> observe -> improve
```

The durable asset is the customer-owned source and data, not a particular UI, agent, protocol, or
hosting provider.

## Source concepts

The current scaffold implements only the entries marked **Current**. The rest are **Direction** and
should be introduced through real vertical slices rather than speculative framework surface.

| Concept                    | Meaning                                                                                                     | Status                     |
| -------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------- |
| Company API                | The explicit closed-world contract of business modules and capabilities                                    | Current, objects/actions   |
| Module                     | A lightweight source and default-UI grouping for a cohesive business capability                             | Current, objects/actions   |
| Object                     | A durable business type such as Company or Contact                                                          | Current                    |
| Record                     | One stored instance with runtime-owned identity, audit fields, annotations, and concurrency token            | Current, base shape        |
| Field                      | A typed value with semantic kind, validation, behavior, and optional default                                | Current                    |
| Relationship               | A typed link between business objects                                                                       | Current, direct links      |
| Operation                  | A conventional create, get, list, update, delete, or batch-get capability exposed by an object              | Current, HTTP projection   |
| Action                     | A custom typed business command with input, output, categorized errors, and an object subject               | Current, HTTP projection   |
| Object interface           | An abstract contract explicitly implemented by multiple concrete objects; it has no records of its own      | Direction                  |
| Tool                       | A typed business capability available to authorized people, apps, or agents                                 | Direction                  |
| Loop                       | A recurring, goal-directed controller that observes state, acts through tools, checks outcomes, and repeats | Vision                     |
| Metric                     | A stable named calculation; observations are its values for a time or window                                | Vision                     |
| Document                   | Source-owned knowledge with identity, authorization, and provenance                                         | Direction                  |
| Skill                      | Source-owned instructions that teach an agent how to perform work                                           | Direction                  |
| App                        | A separately executable interface over the shared backend                                                   | Current                    |
| Connection                 | Authorized access to an external system or capability                                                       | Direction                  |
| Infrastructure declaration | Source-owned desired infrastructure such as a queue, schedule, domain, or secret reference                  | Direction                  |

A module groups the objects, actions, queries, metrics, loops, documents, and skills for one
business capability. It does not namespace client methods, isolate storage or deployment, define a
permission boundary, or prevent actions and references from crossing modules. Apps are
repository-owned deployables rather than semantic API entries because one app commonly spans
several capabilities.

Objects expose conventional create, get, list, update, delete, and batch-get operations by default
and may disable operations explicitly. These operations have uniform semantics and runtime-derived
request and response shapes; companies do not redefine each one as an action. Actions are custom
business verbs such as qualifying a lead. They declare only action-specific input because the
subject record ID is supplied separately by the invocation or transport path.

Every record includes base `id`, `etag`, `annotations`, `createdAt`, `createdById`, `updatedAt`, and
`updatedById` fields. `annotations` is the caller-managed string map; the other fields are
runtime-owned. Company fields may not redefine those names. Normal writes must identify an actor;
bootstrap and migration paths may use an explicit system actor.

Fields preserve semantic kinds such as email, domain, URL, phone, calendar date, timestamp, money,
file, and image rather than collapsing them into text. Record shapes are total: every declared
field is present in output, never optional or `undefined`. Fields are non-nullable by default.
`required` means the caller must supply the field on create; otherwise omission applies an explicit
default, the kind's honest zero value, or `null` only when `nullable: true` is declared. Textual
values use `""`, numbers use `0` when their constraints permit it, and future collection fields use
`[]` or `{}`. References, dates, timestamps, money, files, images, and selects have no universal
zero value, so an ordinary field of one of those kinds must be required, nullable, or defaulted.

Output-only and immutable remain independent behaviors. Output-only fields are supplied by the
runtime and excluded from create and update. Immutable fields may be repeated on update, but
changing their stored value is a validation failure. Update omission means no change; a kind's zero
value clears an ordinary field, while `null` clears only a nullable field. Write-only secrets are
operation or action inputs rather than object fields.

Standard transport failures use shared unauthenticated, permission-denied, not-found, conflict,
and validation shapes; they are not redefined for each object. Validation details distinguish
field violations from global violations so interfaces do not parse prose. Declared company errors
are reserved for meaningful domain failures and use a stable company-facing code, a human-facing
message, typed details, and a standard semantic category. Protocol projections map categories to
their own status representation; company definitions do not contain HTTP status codes.

## Data-model vision

Model durable business truth with ordinary typed objects and relationships. Use semantic
definitions so apps and agents share identity, constraints, display meaning, authorization,
provenance, and discoverable operations rather than inferring them independently from storage.

Keep the project database ordinary and source-owned. The framework may compile registered objects
to tables or map them onto company-owned storage, but not every table must become an object. Custom
tables, views, indexes, constraints, functions, extensions, and SQL remain valid implementation.
Only registered concepts join `@acme/api`.

Prefer these integrity rules as the model grows:

- Give each definition an immutable lower-camel ID. Labels and routes may change without changing
  API identity.
- Use `object` for the durable type and `record` for an instance. Avoid `entity` as an ambiguous
  synonym.
- Make polymorphism explicit. An object interface requires opt-in and field mapping; structural
  similarity is not implementation.
- Preserve database integrity for polymorphic references. Do not rely on unchecked type-and-ID
  pairs.
- Derive public descriptions and client types from registered definitions. Do not maintain a
  second handwritten model contract.
- Keep the semantic schema portable and serializable. Runtime integrations may compile it to
  Effect Schema, JSON Schema, OpenAPI, forms, or other projections without changing company source.
- Store files and images as stable asset references rather than delivery URLs. Upload, download,
  preview, crop, and signed-URL behavior are projections and runtime implementation concerns.
- Give each synchronized fact one authority. Derived views and caches never govern business truth.

## Operating loops and improvement

A loop is not merely a scheduled workflow. It represents a real recurring business operation with
an objective, observable state, governed actions, metrics, and points where human judgment is
required.

A metric defines a calculation, unit, dimensions, and time window. A loop supplies contextual
targets and guardrails. The same metric may have different expectations in different loops.

Outcomes, corrections, and evaluations may support proposed improvements, but nothing silently
retrains the system or changes production behavior. Improvements should arrive as explicit,
reviewed, tested, and reversible source changes.

## Naming discipline

- Name business concepts in company language under `@acme/*`.
- Name reusable framework concepts only after multiple business slices prove the common contract.
- Name ports after capabilities the company consumes and adapters after providers.
- Do not promote a UI container, protocol, job, or vendor into a product-level business concept.
