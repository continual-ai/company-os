---
name: continual
description:
  Evolving context for deciding whether and how an optional hosted Continual platform should
  interact with the standalone Company OS. Use for hosted identity, agent execution, connections,
  infrastructure, deployment, controls, audit, and platform ownership questions; not for ordinary
  local runtime implementation.
---

# Continual

Use this skill to reason about an optional hosted-platform boundary. It is not a catalog of shipped
features or a commitment to a particular platform design.

## How to use it

1. Inspect the Company OS code and any current hosted-platform evidence relevant to the request.
2. Define the capability and the outcome before choosing local, direct-provider, or
   Continual-operated ownership.
3. Read only the relevant reference below.
4. Compare alternatives and state who owns truth, policy, credentials, lifecycle, recovery, and
   operator control.
5. Distinguish verified **Current** behavior from proposed **Direction** and **Vision**.

Never infer hosted availability or contract details from names or local integration code in this
repository. Verify live APIs, authentication, limits, and failure semantics before integration.

## Read selectively

| Question | Read |
| --- | --- |
| Product ownership, hosted-versus-standalone responsibility, or platform vocabulary | [references/platform.md](references/platform.md) |
| Identity, agents, connections, deployment, credentials, or failure boundaries | [references/integration.md](references/integration.md) |
| Customer-side business model and source architecture | Use `$company-os` |

Read both references only when introducing or materially changing a platform dependency.

## Context not obvious from code

- Continual is being explored as an optional operator around a customer-owned Company OS, not as
  the necessary owner of its business model.
- The vendored `@company/*` foundation does not imply a hosted Continual dependency.
- A hosted capability should be justified by concrete operational value, not by a desire to route
  everything through Continual.
- Platform interfaces, conversations, queues, caches, and audit views should not silently become a
  parallel business authority.

## Avoid biasing the design

- Do not require a platform adapter, local fallback, or provider abstraction when the concrete
  capability does not benefit from one.
- Do not reserve packages or interfaces for hypothetical hosted features.
- Do not encode an explored platform concept as customer-facing framework doctrine.
- Recommend a direct or standalone design when it is stronger for the actual requirement.

## Maintenance

Keep only non-obvious and durable platform context. Remove implementation inventories, stale
capability claims, migration notes, and proposals that have not been accepted or proven.
