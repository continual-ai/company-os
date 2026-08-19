# Continual platform boundary

> Draft working boundary, not a promise of current platform behavior. Challenge it from first
> principles and update it when a better design is accepted or proven.

## Relationship to Company OS

Continual is an optional platform for building, running, and governing a customer-owned Company OS.
The Company OS remains the software and data the customer owns. The platform surrounds that system
with shared access, infrastructure, execution, and delivery services.

This standalone repository must remain useful without the hosted platform. The local
`@continual/*` packages are reusable framework code, not proof of a platform dependency.

## Ownership split

| Customer-owned Company OS    | Continual-operated platform                        |
| ---------------------------- | -------------------------------------------------- |
| Business objects and records | Workspace and project tenancy                      |
| Rules, policy, and approvals | Authentication and principal establishment         |
| Tools and integration logic  | Agent execution and conversations                  |
| Documents and agent skills   | Connection installation and credential custody     |
| Metrics and operating loops  | Managed databases and infrastructure lifecycle     |
| Company apps and UI          | Builds, releases, deployments, and environments    |
| Business data and migrations | Platform controls, logs, usage, and audit delivery |

The platform may provision and operate a project database, but it must not interpret customer
tables or become a privileged business-data path. Business reads and writes still go through the
customer backend.

## Platform concepts

- **Workspace:** the tenant for people, access, and commercial administration.
- **Project:** the platform namespace connecting one customer backend to its source, database,
  semantic API, apps, connections, delivery state, and work history. A Project operates and deploys
  that API but is not its definition. Do not confuse it with a company-defined business object also
  named Project.
- **Connection:** an installed, authorized relationship with an external system, including its
  configuration and lifecycle.
- **Thread or conversation:** interaction and execution context for people and agents, not a store
  of business truth.
- **Work queue:** review, exception, and approval coordination that refers back to governed backend
  records and invocations.
- **Environment and deployment:** platform-owned running state derived from a versioned source
  revision and artifacts.

Platform resources are control-plane entities with platform identity, hierarchy, lifecycle, and
authorization. Customer business objects are a separate data model. Never move a business noun
into the platform resource model merely because the platform needs to display or reference it.

## Source and delivery

One source revision should identify the compatible backend and app artifacts for a release. The
platform may build and deploy them independently against the same versioned contract. Upstream
starter or framework improvements should arrive as proposed source changes; they must not mutate a
customer project silently.

A platform gateway may authenticate an actor, filter discovery, route calls, and record
invocations. It should federate only narrow platform capabilities with the customer backend and
must not copy business logic or business data into a second authority.

## Accuracy rules

This document captures durable product and architecture direction distilled into this standalone
repository. It is not an inventory of currently available hosted features. Before implementing a
platform integration, verify the live API or SDK contract, authentication model, availability,
limits, deployment behavior, and failure semantics from current platform evidence.
