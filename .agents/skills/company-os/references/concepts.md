# Company OS product context

This is a vocabulary and decision aid, not a roadmap or schema specification. Verify current
definitions in code and introduce a concept only when a real company operation needs it.

## Product hypothesis

A Company OS is source-owned software through which a company defines and operates its business.
The aspiration is shared business meaning across customer-facing software, internal work,
integrations, and agents while the company retains its source and data.

That aspiration does not determine one UI, protocol, hosting model, database layout, agent model, or
framework API. A useful design should make an actual company operation clearer, safer, or easier to
change.

## Working vocabulary

These meanings help discussion; they do not require corresponding framework types.

| Term | Working meaning |
| --- | --- |
| Operating model | The business meaning and policy a company actually runs on |
| Object | A durable business type; a record is one stored instance |
| Capability | Something an authorized person, app, integration, or agent can do |
| Module | A possible way to organize related source or navigation; its effect on API, storage, policy, and deployment is deliberately undecided |
| App | An executable interface over company capabilities, often spanning several business concerns |
| Document | Knowledge with identity, provenance, and access rules |
| Skill | Source-owned instructions for performing work |
| Metric | A named interpretation of observations, including units and relevant context |
| Loop | A possible model for recurring goal-directed work that observes outcomes and acts again |
| Connection | An authorized relationship with an external system, including its lifecycle |

Objects, links, fields, actions, and schemas already have concrete representations in the
repository. Their code and tests—not this reference—define their current behavior.

## Product decision lenses

When adding or changing a concept, ask:

- What real operation or customer outcome requires it?
- Is it durable business truth, an interface concern, execution machinery, or derived state?
- Who is authoritative for it, and how is conflicting state repaired?
- Does it need a named semantic concept, or can ordinary TypeScript and application code express it?
- Which people, apps, integrations, or agents must share it?
- What is the smallest vertical slice that could validate the idea?

## Data-model posture

Favor ordinary typed business data and database integrity. Semantic metadata is useful when it lets
multiple consumers share meaning, validation, authorization, or display behavior; it is not a goal
to model every table or implementation detail in a framework.

Preserve one authority for each fact. Treat caches, search indexes, analytics, generated documents,
and protocol descriptions as derived unless a concrete design establishes otherwise. Keep files as
stable business references rather than coupling durable data to a delivery URL.

## Future concepts

Loops, metrics, documents, skills, polymorphic object interfaces, and infrastructure declarations
are hypotheses. Do not infer that they are planned, required, or correctly named because they
appear here. If a slice earns one, define its semantics from that operation and update this
reference with only the durable lesson.

Outcomes and evaluations may inform proposed improvements, but production behavior should change
through explicit, reviewable, and reversible mechanisms rather than silent self-modification.

## Naming

- Use the example company's language for business concepts.
- Name reusable concepts only after more than one concrete use establishes common semantics.
- Avoid promoting a transport, vendor, UI container, or background job into a product-level noun.
