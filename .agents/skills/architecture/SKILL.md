---
name: architecture
description:
  Product intent and ownership context that code alone cannot answer. Use for business meaning,
  package responsibility, API and persistence boundaries, authorization, and whether a capability
  belongs here or in a hosting platform. Not for code navigation.
---

# Architecture

Decision context, not a specification. Current code is evidence, not a freeze. Read the code first
and open this only for intent, ownership, or a real tradeoff. Recommend a better design than the
current one when a concrete slice supports it. Label **Current**, **Direction**, and **Vision** when
the difference matters. User decisions and verified behavior outrank these notes.

## Intent

Code holds durable business truth, permissions, and consequential actions. AI interprets, researches,
plans, and handles exceptions through those same actions. People set goals and decide where approval
is required. Customer-facing software, internal work, integrations, and agents should share records
and capabilities instead of becoming separate authorities.

The owner owns the business source, policy, and data. A hosting platform may operate infrastructure
or access; it must not become a second source of business truth. Keep reusable code
provider-neutral, and put platform-specific code only at a real integration boundary.

## Before adding structure

Name the authoritative state and policy, the callers, where identity and authorization are
established, the transaction and failure boundary, external effects and their repair behavior, and
which outputs are derived. Then choose the smallest implementation preserving those properties.
Services, ports, events, queues, and separate deployments are options, not required layers.

A modular monolith, one database, and one transaction are good defaults. When a transaction triggers
external work, decide explicitly whether to fail before commit or commit durable intent and retry
after. Keep one authority per fact; caches, indexes, analytics, and generated documents are derived
and must be repairable.

Add an abstraction or package only when it has a stable responsibility proven by real callers,
removes provider or transport coupling from business behavior, is clearer than what it hides, or
protects a browser/server, trust, transaction, or deployment boundary. Do not extract to match a
diagram or a future platform idea.

## Semantic surface

Several interfaces exposing one capability must not hold independent implementations; derive
projections where that reduces drift, but do not push transport concerns into the durable model.
Prefer ordinary typed data and database integrity. Semantic metadata earns its place when multiple
consumers share meaning, validation, authorization, or display — not by describing every table.

Deliberately unsettled: the semantic API vocabulary, whether modules affect more than organization,
URL and projection conventions, persistence and migration ownership, approval semantics, and the
long-term split between reusable runtime, company source, and hosted services.

## Naming

Use the company's own language for business concepts, and say plainly who owns code, data, policy,
or runtime. This repository is the foundation, not the required visible product name. Name a
reusable concept only after a second real use establishes shared semantics. Do not promote a
transport, vendor, UI container, or background job into a product noun, and do not use future
vocabulary to justify empty framework surface.
