# Continual integration patterns

> Draft integration guidance. Use only what helps the concrete capability, reject unnecessary
> layering, and update this reference as real integrations reveal better boundaries.

## Default posture

Keep the core Company OS locally operable. Add a Continual dependency at a boundary where the
platform provides a concrete capability, and preserve a direct-provider, local, or in-memory path
when it is meaningful.

Bind hosted implementations in `apps/company-api/src/composition-root.ts`. Keep Continual API or
SDK types inside the adapter. Company services consume semantic company-owned contracts.

## Capability ports and adapters

Name a port after the capability the company consumes and an adapter after the provider:

```text
agent-execution-port.ts       ContinualAgentExecutionAdapter
identity-provider-port.ts     ContinualIdentityProviderAdapter
deployment-port.ts            ContinualDeploymentAdapter
```

Create a port only when all are true:

- it hides provider-specific types or lifecycle;
- its contract is smaller and more stable than the provider API;
- at least one meaningful alternate implementation exists;
- the company owns the capability semantics expressed by the port.

Do not wrap every external dependency. If business code legitimately consumes a provider-native
abstraction and no stable smaller contract exists, keep it explicit at the edge until experience
reveals the boundary.

## Connectors

Use a richer Connector when the integration owns product-visible installation lifecycle such as
OAuth, configuration, credential rotation, webhooks, polling, synchronization, settings,
maintenance, and uninstall. Compose it from narrow capabilities where useful.

Keep connector lifecycle separate from business integration logic. For example, installing a CRM
connection may be platform work, while deciding how an imported account becomes a Customer remains
company-owned logic.

## Identity and authorization

Let the platform authenticate and establish a verified principal. Map that principal into the
backend invocation context, then evaluate company roles, policy, row scope, approvals, and
constraints inside the backend.

Do not trust actor IDs or permissions supplied by a browser or agent. Do not duplicate company
authorization rules in the platform console or an adapter.

## Agent access

Give the Continual agent and authorized external agents the same governed backend capabilities used
by apps. Prefer a project-scoped MCP or equivalent typed contract with permission-filtered
discovery. Never give an agent raw database access or agent-only bypass tools.

Changing between conversation, a connected channel, or another agent changes delivery, not the
actor's project identity, permissions, or business capabilities.

## Source and deployment

Keep the runtime compatible with ordinary Fetch. A deployment adapter may package, publish, and
observe a versioned backend or app without changing the domain contract. Record which source
revision and artifact are running so changes remain attributable and reversible.

Treat environment, release, deployment, and running app state as platform concerns. Treat schema,
migrations, business definitions, and app source as customer concerns.

## Failure behavior

- Make webhook, command, scheduled, and repair paths converge on one idempotent operation.
- Treat external delivery as at least once unless the verified platform contract proves otherwise.
- Keep platform unavailability from corrupting committed business state. Queue retryable effects
  after commit or fail before the transaction begins.
- Preserve provenance across the adapter: actor, project, source revision, invocation, and external
  correlation IDs where applicable.
- Test the port contract with a local or in-memory implementation and add a focused adapter test
  against current platform behavior when credentials and a safe environment are available.
