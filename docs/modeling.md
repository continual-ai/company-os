# Modeling

The model is the shared vocabulary that the application, generated interfaces, integrations, and
agents use. It is composed in `app.model.ts` from module definitions and exported to optional apps
as `company-os/model`. Definitions are portable TypeScript; execution, authorization, persistence,
and configuration live in `runtime/server` and the shell. Code and tests are authoritative for exact
types; this guide explains how the concepts fit.

## Vocabulary

- A **Model** is the validated catalog one installation exposes.
- A **Module** groups definitions for composition and enablement. It is not a runtime boundary or
  a separate source of authority.
- The **Root** is the kernel's singleton owner at the top of the hierarchy; the **Actor** is the
  kernel identity that operations attribute writes to.
- An **Object** is a durable record type with identity, lifecycle, and policy.
- An **Interface** names a role several object types implement, such as `NoteSubject`.
- A **Property** is schema-declared data on an object, interface, or operation value.
- A **Query** reads state. An **Action** is a governed operation that may change it.
- An **Event** is a declared business fact appended in the transaction that made it true.

Every object receives standard Queries and the CRUD Actions it does not disable. Add a custom Action
for a transition or invariant ordinary writes cannot express; its implementation owns authorization,
the transaction boundary, and failure behavior.

## One representation per relationship

| Need                                                                          | Model it as                            |
| ----------------------------------------------------------------------------- | -------------------------------------- |
| Durable ownership and authorization inheritance                               | `parent`                               |
| Directional state stored on one record                                        | A `schema.reference` property          |
| Shared bidirectional vocabulary without independent identity                  | A Link                                 |
| Attributes, lifecycle, history, or distinct authorization on the relationship | An Object referencing its participants |

Never encode one fact as both a property and a Link. Declare exact cardinality only when storage,
deletion behavior, and tests preserve it. Objects default to the Root as parent; set `parent` only
for real ownership. A reference owns its foreign key, restricts deleting its target, and may declare
`inverse: { key, label }` for the reverse direction. Links declare both traversal directions so
storage orientation never leaks into the contract. `modelRelationships(Model)` projects references,
Links, and ownership into one catalog that navigation and record pages consume.

Prefer many-to-many Links for business participation. A primary role is a `subsetOf` selection from
that Link: `ContactPrimaryCompany` is a subset of `ContactCompanies`, selecting a primary adds the
membership in the same transaction, a composite key guarantees every primary is a member, and
removing the membership clears the selection. Use an association Object when participation needs
dates, roles, allocation, or its own permissions; `Escalation` in `support-engineering` carries a
durable receipt for a cross-module transition.

## Properties and invariants

A writable property is required on create unless it is nullable or has a default. `outputOnly`
properties come from the implementation and are never accepted from callers. `uniqueBy` declares
identity rules storage enforces transactionally; Link cardinality already owns edge uniqueness, so
do not restate it. Reference properties use the relationship noun (`company`, `principal`), never an
`Id` suffix. Every record has one canonical id and may carry aliases from external systems; public
operations accept either, while stored references and events use canonical ids. `search.fields`
opts an object into record search; `display` names the title, subtitle, status, image, and icon
that every generated surface uses.

`pnpm --filter company-os model:check` lints descriptions, labels, and naming across the composed
model. After changing definitions, regenerate the storage projection with the
[database workflow](runbooks/database.md) and run `pnpm check` and `pnpm test`.
