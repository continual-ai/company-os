---
name: company-customize
description:
  Customize an established Company OS fork by changing its model, governed capabilities, workflows,
  integrations, background work, branding, or interface. Use for company-specific product work
  after onboarding, including deciding whether a request belongs in the central application, in a
  separate optional app created per AGENTS.md, or needs a clarifying question first. Not for initial
  discovery or merging upstream scaffold changes.
---

# Company Customize

Make company-specific changes through the narrowest authoritative surface while keeping people,
agents, and external interfaces on the same governed business capabilities.

## Orient to the change

1. Inspect `AGENTS.md`, the current checkout, relevant definitions, services, routes, migrations,
   tests, and the import boundaries between `runtime/`, `modules/`, and `app/`. Existing code is evidence of current behavior, not proof that its
   shape is permanent.
   When `.agents/skills/company-context/SKILL.md` exists, read it for durable company language,
   priorities, sources, and known unknowns relevant to the requested change.
2. Restate the requested outcome in the company's language and identify the authoritative state,
   actor and authorization boundary, transaction boundary, external effects, and affected callers.
3. Classify the change before choosing an abstraction:
   - durable meaning: Objects, interfaces, links, fields, Actions, policy, or migrations;
   - governed execution: services, repositories, Action handlers, jobs, or integrations;
   - projection: HTTP, MCP, SDK, agent tool, query, or derived view; or
   - experience: route, navigation, form, table, workflow UI, copy, or theme.

Use `$company-os` only when business semantics, ownership, or an architecture choice cannot be
resolved from the requested outcome and repository.

## Customize coherently

- Keep the semantic surface small. Use standard Queries and CRUD Actions for ordinary record work;
  use a custom Action for a named business transition, multi-record invariant, approval, or
  consequential external effect.
- Put business policy in one governed capability and project it to each interface. Do not put the
  authoritative implementation in a React component, route handler, MCP tool, or background job.
- Preserve browser-safe model definitions and existing runtime, persistence, UI, and application
  ownership boundaries.
- For external work, decide whether the transaction must fail before commit or should commit
  durable intent for retryable processing afterward. Make retries, idempotency, cancellation, and
  repair behavior explicit when they matter.
- When increasing automation, identify what starts the work, the outcome it should produce, which
  steps are deterministic, where AI may exercise judgment, which decisions require a person, how
  failures surface, and what evidence records success. Do not create a privileged agent-only path;
  reuse the same governed actions available to other authorized callers.
- Keep branding in the existing tokens and public asset conventions. Preserve provenance for newly
  downloaded assets.
- Update or remove documentation in the same change that makes it inaccurate, but do not add
  inventories or roadmap prose that duplicates code.

## Enabling and disabling behavior

Whole modules are enabled by the list in `apps/company-os/src/app.config.ts`. Removing a module id
hides its screens, endpoints, and MCP tools together while its tables and data stay; the list must
stay closed under dependencies. For anything finer than a module:

1. Determine whether the user means hide from the interface, deny invocation, stop runtime work, or
   retire durable data. These are different operations.
2. Use an existing truthful boundary: model action settings, authorization, navigation
   configuration, or provider configuration.
3. Do not delete definitions or migrations as a substitute for deactivation, and do not leave an
   API callable while describing the feature as disabled.
4. Do not add environment switches or per-feature flag matrices; two deployments with different
   capabilities are two commits.

Follow the customization ladder in `AGENTS.md`: add a module first, edit a shipped module second,
edit `runtime/` last and say why in the commit.

## Verify the complete story

Test the authoritative behavior and each affected projection. Run focused tests, `pnpm check`, and
`pnpm build` after routing, bundling, or application dependency changes. Inspect status and diff for
unrelated edits and report durable changes, migrations, exposed interfaces, operational effects,
and any activation limitation that remains.
