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
| Project or company model   | The explicit closed-world composition of modules and apps                                                   | Current                    |
| Module                     | A cohesive, headless business capability                                                                    | Current, objects only      |
| Object                     | A durable business type such as Customer or Project                                                         | Current                    |
| Record                     | One stored instance of an object                                                                            | Direction                  |
| Field                      | A typed value declared on an object                                                                         | Current                    |
| Relationship               | A typed link between business objects                                                                       | Current, direct links      |
| Object interface           | An abstract contract explicitly implemented by multiple concrete objects; it has no records of its own      | Direction                  |
| Tool                       | A typed business capability available to authorized people, apps, or agents                                 | Direction                  |
| Loop                       | A recurring, goal-directed controller that observes state, acts through tools, checks outcomes, and repeats | Vision                     |
| Metric                     | A stable named calculation; observations are its values for a time or window                                | Vision                     |
| Document                   | Source-owned knowledge with identity, authorization, and provenance                                         | Direction                  |
| Skill                      | Source-owned instructions that teach an agent how to perform work                                           | Direction                  |
| App                        | A separately executable interface over the shared backend                                                   | Current, registration only |
| Connection                 | Authorized access to an external system or capability                                                       | Direction                  |
| Infrastructure declaration | Source-owned desired infrastructure such as a queue, schedule, domain, or secret reference                  | Direction                  |

A module should eventually keep the objects, tools, metrics, loops, documents, and skills for one
business capability together. Apps remain outside modules because one app commonly spans several
capabilities.

## Data-model vision

Model durable business truth with ordinary typed objects and relationships. Use semantic
definitions so apps and agents share identity, constraints, display meaning, authorization,
provenance, and discoverable operations rather than inferring them independently from storage.

Keep the project database ordinary and source-owned. The framework may compile registered objects
to tables or map them onto company-owned storage, but not every table must become an object. Custom
tables, views, indexes, constraints, functions, extensions, and SQL remain valid implementation.
Only registered concepts join the shared semantic contract.

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
