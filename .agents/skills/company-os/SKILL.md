---
name: company-os
description:
  Draft, evolving Company OS product and architecture context for this repository. Use when
  reasoning about or changing business objects, modules, tools, loops, metrics, documents, skills,
  apps, data-model semantics, runtime contracts, authorization, persistence, API or MCP surfaces,
  package boundaries, or code under packages/acme, packages/continual, and apps.
---

# Company OS

## Status: working draft

Treat this skill and its references as concise working context, not a specification. The product,
vocabulary, layers, and architecture are actively evolving and are not locked. Inspect the code and
reason independently before accepting an existing design.

## Reason from first principles

- Start from the customer or company outcome, real operation, constraints, and failure modes.
- Identify the minimum concepts and boundaries required; do not preserve a layer or abstraction
  merely because it appears here.
- Compare credible alternatives and recommend the strongest design, including one that contradicts
  current thinking.
- Separate **Current** implementation, **Direction** under consideration, and longer-term **Vision**.
  Never present Direction or Vision as shipped.
- Prefer evidence from working vertical slices, code, tests, and actual use over architectural
  elegance or internal terminology.

Inspect `README.md`, `AGENTS.md`, the affected package manifests, and the implementation before
making claims. Code and explicit user decisions outrank this skill.

## Read selectively

| Task                                                                                          | Read                                                     |
| --------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Business vocabulary, data-model design, modules, tools, loops, metrics, or knowledge          | [references/concepts.md](references/concepts.md)         |
| Package ownership, app/backend boundaries, persistence, governance, or architecture evolution | [references/architecture.md](references/architecture.md) |
| Hosted identity, agents, connections, deployment, environments, or audit                      | Use `$continual`                                         |

For a new end-to-end business capability, read both references.

## Durable starting points

- Keep source and business data customer-owned and locally operable.
- Keep one company API contract behind public software, customer portals, internal operations, and
  agents.
- Put company-specific nouns and behavior in `@acme/api` or `apps/*`; keep
  `@continual/runtime` reusable.
- Keep the server boundary of `apps/company-os` as the private composition root. Pass dependencies
  explicitly at real external boundaries.
- Treat a modular monolith, ordinary Postgres, and one transaction boundary as economical defaults,
  not permanent laws.
- Earn abstractions from concrete slices. Keep vendor types at the edge and business policy in the
  backend.

## Improve this skill

When implementation evidence or an accepted decision changes the architecture, update this skill
and the relevant reference. Keep only durable, decision-relevant context; remove stale assumptions,
temporary migration state, repeated explanation, and ideas that were merely explored.
