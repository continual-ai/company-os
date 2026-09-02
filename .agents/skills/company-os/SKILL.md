---
name: company-os
description:
  Evolving product and ownership context for Company OS decisions that the repository cannot answer
  from code alone. Use for business-model semantics, customer ownership, package responsibility,
  API boundaries, persistence, authorization, and architecture direction; not for routine code
  navigation or inventories of current exports.
---

# Company OS

Use this skill as decision context, not as a specification. Company OS is still being designed.
Examples in the repository demonstrate possibilities; they do not make every current name, type,
route, package, or abstraction permanent.

## How to use it

1. Inspect the relevant code, tests, package manifests, `AGENTS.md`, and nearby README first.
2. Identify what remains unanswered: product intent, ownership, authority, or a real tradeoff.
3. Read only the reference that addresses that question.
4. Compare plausible designs and recommend the strongest one for the concrete slice, including a
   design that differs from current code or these notes.
5. Label claims as **Current**, **Direction**, or **Vision** when the distinction matters.

Explicit user decisions and verified behavior outrank this skill. Repository instructions govern
how to change the code; this skill explains why a boundary may matter.

## Read selectively

| Question | Read |
| --- | --- |
| Product meaning, business vocabulary, or future concepts | [references/concepts.md](references/concepts.md) |
| Ownership, authority, data, package, or runtime boundaries | [references/architecture.md](references/architecture.md) |
| Standalone-versus-hosted responsibility | [references/architecture.md](references/architecture.md) and the hosting notes below |

Read both references only for a genuinely cross-cutting design decision.

## Context not obvious from code

- A central product hypothesis is that public software, internal operations, integrations, and
  agents should share business meaning and governed capabilities instead of becoming independent
  authorities. The exact contract and interface shapes remain open.
- Local operation, ordinary infrastructure, and a modular monolith are economical starting points,
  not product doctrine.
- A hosting platform such as Continual is an optional operator around a company-owned Company OS,
  not the owner of its business model. The vendored `@company/*` foundation implies no hosted
  dependency, a hosted capability must be justified by concrete operational value, and platform
  interfaces, conversations, queues, caches, or audit views must not silently become a parallel
  business authority. When the platform must supply something, define the boundary in company terms
  and keep the concrete provider replaceable.

## Avoid biasing the design

- Do not turn a current implementation detail into a requirement unless tests, repository
  instructions, or an explicit decision establish it as one.
- Do not use future vocabulary to justify empty framework surface.
- Do not restate exports, schemas, routes, field lists, or unfinished-feature inventories here;
  inspect their authoritative code instead.
- Prefer evidence from a working vertical slice over consistency with these notes.
- Do not require a platform adapter, local fallback, or provider abstraction when the concrete
  capability does not benefit from one, and do not reserve packages or interfaces for hypothetical
  hosted features.

## Maintenance

Update this skill only when a decision adds non-obvious, durable context. Remove guidance once code,
tests, or repository instructions communicate it adequately, and remove proposals that were merely
explored.
