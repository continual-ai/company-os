---
name: continual
description:
  Draft, evolving Continual platform context for the standalone Company OS. Use when reasoning
  about or changing hosted identity, workspaces or projects, agent execution, conversations, work
  queues, connections, managed databases, source and deployment, environments, MCP gateways,
  approvals, audit, or boundaries between source-owned code and platform-operated services.
---

# Continual

## Status: working draft

Treat this skill and its references as a compact hypothesis about the platform boundary, not a
locked platform design. Continual and Company OS are evolving together. Verify current code and
platform behavior, reason independently, and recommend a better boundary when one exists.

## Reason from first principles

This repository uses `@continual/*` for reusable, local framework packages. That does not mean the
hosted Continual platform is required. Keep these concerns separate:

- **Framework:** model definitions, runtime, client, UI, Studio, and CLI that run from this repo.
- **Platform:** optional surrounding services such as identity, agent execution, connections,
  managed infrastructure, deployment, controls, and audit.

- Start from the capability and outcome the company needs, then compare local, direct-provider, and
  Continual-operated designs.
- Decide explicitly who owns business truth, policy, credentials, lifecycle, failure recovery, and
  operator control.
- Recommend the simplest strong design even when it conflicts with this draft or the current
  platform shape.
- Distinguish current capability from proposed Direction and longer-term Vision. Verify live
  contracts before relying on availability, payloads, limits, or deployment behavior.

## Read selectively

| Task                                                                                       | Read                                                   |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| Ownership split, platform concepts, Project meaning, or hosted-versus-standalone reasoning | [references/platform.md](references/platform.md)       |
| Ports, adapters, connectors, backend access, identity, agents, or deployment integration   | [references/integration.md](references/integration.md) |
| Customer-side business model or source architecture                                        | Use `$company-os`                                      |

Read both references when introducing a new platform dependency.

## Durable starting points

- The company owns its source, data, operating model, apps, documents, skills, and integration
  logic.
- Keep the standalone path useful unless a concrete requirement makes hosted operation mandatory.
- Do not let platform interfaces, agents, work queues, or caches become a second business authority.
- Express a platform dependency through a narrow boundary only when that boundary is genuinely
  useful; do not manufacture pluggability.
- Treat MCP and other protocols as access mechanisms, not substitutes for policy, approvals,
  idempotency, or audit.

## Improve this skill

When implementation evidence or an accepted decision changes the platform boundary, update this
skill and the relevant reference. Preserve only durable, useful context; remove stale platform
assumptions, implementation inventories, migration notes, and unaccepted proposals.
