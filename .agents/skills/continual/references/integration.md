# Continual integration context

Use this reference to choose an integration boundary, not to impose ports and adapters on every
hosted dependency.

## Start with the capability

Compare the simplest credible local, direct-provider, and Continual-operated designs. For each,
make ownership of business policy, credentials, installation lifecycle, retries, repair, and
operator control explicit.

Integrate directly when provider-native behavior is the honest contract. Introduce a company-owned
boundary when it isolates meaningful policy or protects the business from unstable provider types.
Use a richer connector only when installation and ongoing lifecycle are themselves product-visible
responsibilities.

Do not require multiple implementations merely to claim portability. An alternate implementation
is valuable when it supports local development, testing, recovery, customer choice, or a credible
provider change.

## Identity and authorization

A platform may establish an authenticated principal. The company backend should still decide
business roles, row scope, approvals, and action constraints unless a different authority is
explicitly chosen.

Do not accept browser- or agent-supplied identity claims without verification. Avoid maintaining
the same company policy independently in a platform UI and the backend.

## Agent and tool access

Prefer governed business capabilities over raw database credentials or privileged agent-only
bypasses. Changing the conversational or channel surface should not silently change the actor's
business authority.

The appropriate protocol—ordinary HTTP, MCP, or something else—is an access choice. It does not by
itself provide policy, approval, idempotency, provenance, or audit.

## Source and deployment

Keep source, schema, migrations, and business definitions attributable to the customer project.
When the platform builds or deploys them, record enough revision and artifact identity to explain
and reverse what is running.

Do not assume one deployment topology. Preserve a conventional runtime boundary where practical so
local and hosted operation remain design options.

## Failure questions

- Does platform failure occur before the company transaction, or after durable intent is committed?
- Which calls may be delivered more than once, and where is idempotency enforced?
- How are webhooks, scheduled work, manual repair, and ordinary commands reconciled?
- Which provenance must cross the boundary for support and audit?
- Can derived platform state be rebuilt from authoritative records?

Test the business-facing contract locally when that test adds confidence. Test the hosted adapter
against current platform behavior when credentials and a safe environment are available.
