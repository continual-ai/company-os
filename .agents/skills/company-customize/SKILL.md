---
name: company-customize
description:
  Customize an established Company OS fork by changing its model, governed capabilities, workflows,
  integrations, background work, branding, or interface. Use for company-specific product work
  after onboarding, not initial discovery or merging upstream scaffold changes.
---

# Company Customize

Make company-specific changes through the narrowest authoritative surface while keeping people,
agents, and external interfaces on the same governed business capabilities.

## Orient to the change

1. Inspect `AGENTS.md`, the current worktree, relevant definitions, services, routes, migrations,
   tests, and package boundaries. Existing code is evidence of current behavior, not proof that its
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
- Keep branding in the existing tokens and public asset conventions. Preserve provenance for newly
  downloaded assets.
- Update or remove documentation in the same change that makes it inaccurate, but do not add
  inventories or roadmap prose that duplicates code.

## Enabling and disabling behavior

The repository does not yet define a general module lifecycle. When asked to enable, disable, or
opt into functionality:

1. Determine whether the user means hide from the interface, deny invocation, stop runtime work,
   exclude a definition from a deployment, or retire durable data. These are different operations.
2. Use an existing truthful boundary when one exists, such as model action settings, authorization,
   route composition, navigation, or provider configuration.
3. Do not delete durable definitions or migrations as a substitute for deactivation, and do not
   leave a hidden API callable while describing the feature as disabled.
4. Avoid adding a one-off flag matrix. If the request exposes a repeated composition need, describe
   the smallest reusable contract and confirm its scope before creating a module or plugin kernel.

## Verify the complete story

Test the authoritative behavior and each affected projection. Run focused tests, `pnpm check`, and
`pnpm build` after routing, bundling, or application dependency changes. Inspect status and diff for
unrelated edits and report durable changes, migrations, exposed interfaces, operational effects,
and any activation limitation that remains.
