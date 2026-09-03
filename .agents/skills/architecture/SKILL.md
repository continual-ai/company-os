---
name: architecture
description:
  Product and ownership context that the repository cannot answer from code alone. Use for business
  meaning, package responsibility, API and persistence boundaries, authorization, and architecture
  direction; not for routine navigation or inventories of current exports.
---

# Architecture

Decision context, not a specification. Current code is evidence, not a freeze. Read code, tests,
and `AGENTS.md` first. Open this skill only for intent, ownership, or a real tradeoff. Label
**Current**, **Direction**, and **Vision** when that distinction matters. User decisions and
verified behavior outrank these notes.

| Question | Read |
| --- | --- |
| Meaning, vocabulary, or future concepts | [references/concepts.md](references/concepts.md) |
| Ownership, data, package, or runtime boundaries | [references/architecture.md](references/architecture.md) |

People, apps, integrations, and agents should share governed capabilities instead of becoming
separate authorities. A hosting platform may operate the system; it must not own the business
model. Do not invent adapters, packages, or vocabulary for a hypothetical future. Update this skill
only with durable, non-obvious lessons; delete guidance once code already says it.
