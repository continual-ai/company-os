# Company OS architecture context

Use this reference for rationale and tradeoffs that are not evident from the package graph. The
current implementation is evidence, not a target architecture.

## Intended ownership

The repository owner owns its business source, policy, data, applications, and private
implementations. Reusable framework code should remain source-neutral. A hosted platform may
operate infrastructure or access, but should not become a second source of business truth merely
because it hosts or observes the system.

The repository expresses that ownership as one application the company clones: the kernel under
`src/runtime`, every module under `src/modules`, and the shell under `src/app`, all owned source.
A package is a deploy unit, so only apps are packages. Each project has one composed model in
`app.model.ts` and one enabled list in `app.config.ts`; cloning the repository instantiates both.
Focused apps such as a portal remain interfaces over the central app's governed capabilities and
never import its private implementation. Continual-specific code appears only at a real hosted
integration boundary, never as a required foundation for standalone operation. Upgrades are Git
merges from upstream, which is why kernel edits are the last rung of the customization ladder.

## Authority before layering

For a new capability, identify:

- the authoritative business state and policy;
- the callers that need access;
- where actor identity and authorization are established;
- the transaction and failure boundary;
- external effects and their retry or repair behavior;
- which outputs are derived and can be rebuilt.

Then choose the smallest implementation that preserves those properties. Services, repositories,
ports, events, queues, and separate deployments are options, not mandatory layers.

## Interfaces and projections

The working product direction favors shared business meaning behind apps, agents, and external
interfaces. It remains an open design question how much belongs in a semantic definition versus
ordinary code.

When several interfaces expose the same capability, avoid independent business implementations.
Protocol descriptions, clients, forms, and agent tools can be derived where derivation reduces
drift, but a projection should serve a real consumer and should not force transport concerns into
the durable business model.

Effect is currently available for server execution and projections. Keep company definitions useful
without requiring Effect, but reconsider the exact boundary when a concrete slice provides better
evidence.

## Data and effects

A modular monolith, one ordinary database, and one local transaction are good defaults while the
product is young. Split them only for a demonstrated isolation, scaling, ownership, or deployment
need.

When a business transaction triggers external work, decide explicitly whether to fail before
commit or commit durable intent and perform retryable work afterward. Derived queues, indexes,
caches, and analytics should remain repairable. Provider lifecycle and credentials should stay at
an external boundary rather than leak into company policy.

## Extraction tests

Consider a new abstraction or package when it:

- has a stable responsibility proven by concrete callers;
- removes provider or transport coupling from business behavior;
- is smaller and clearer than the dependency it hides;
- has a meaningful second use or implementation; or
- protects a real browser/server, trust, transaction, or deployment boundary.

Do not extract solely to match a diagram, a future platform idea, or a familiar architecture style.

## Open design questions

Treat at least these as revisable unless the user explicitly settles them:

- the final semantic API vocabulary and how much behavior it describes;
- whether module enablement should ever become a governed runtime record rather than code;
- client grouping, URL conventions, and protocol projection details;
- persistence mapping and migration ownership;
- authorization and approval semantics;
- whether the kernel should ever be published as a versioned package instead of merged as source.

## Source-owned starting points

A starter domain is editable company source, not a provider-owned product schema. Prefer a useful
initial model with a complete operation over a generic plugin mechanism. Companies can replace
its vocabulary and policy. Keep the one authority and explicit dependencies while allowing that
control; do not turn a particular CRM or engineering workflow into a platform requirement.

The distinction between login and business policy is durable: a host may verify who entered the
application, while the company decides what that principal can do to its records. A cached UI
capability result is never the authority for a business transition.
