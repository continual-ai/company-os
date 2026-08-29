---
name: company-onboard
description:
  Adapt a fresh or lightly customized Company OS fork to a specific company and first operating
  use case, including company research, terminology, model changes, and a working vertical slice.
  Use for initial company setup, not routine later feature work or upstream sync.
---

# Company Onboard

Turn the starter into a coherent first version of the user's own company software. Success means
the company is recognizable, one requested operation works end to end, its result is durable and
reviewable, and the user has a credible next improvement to make.

Every complete project has exactly one `apps/company-os` and one `@company/model`; onboarding
customizes those source-owned foundations rather than instantiating another central app. If either
is absent, treat the checkout as incomplete instead of generating a replacement. Interpret all
available user and company context without asking the user to repeat facts already present.

## Establish the target

Inspect `AGENTS.md`, the worktree, model, app composition, routes, customization overlay,
migrations, and nearby tests. Identify:

- the company, its preferred language, and the initial users;
- the work or event entering the operation and the outcome it should produce;
- the authoritative records and deterministic rules;
- where an agent may exercise judgment and where a person must decide;
- failure, retry, and repair behavior;
- durable evidence that the operation succeeded; and
- the smallest useful end-to-end slice.

Use first-party company evidence when it is identifiable. Distinguish verified facts, reasonable
inferences, and user decisions. Ask a question only when the unresolved answer would materially
change the model, permissions, destructive data work, or first slice; otherwise make a reversible
assumption and disclose it.

Use `$company-os` only when product meaning, ownership, or an architecture tradeoff remains unclear
after inspecting the repository.

## Read when relevant

- For public-company research, brand assets, visual adaptation, or durable company context, read
  [references/brand-and-context.md](references/brand-and-context.md).
- For a purpose-built first authenticated experience, proof moment, or team handoff, read
  [references/first-launch.md](references/first-launch.md).

## Build one governed operation

Start with `apps/company-os/src/customization` for identity, assets, navigation, and the first
authenticated experience. The overlay is ordinary source code, not a page schema or plugin API.

For business behavior, model the company's nouns and relationships in the portable contract, add
migrations for durable changes, and implement one governed path through persistence, service or
Action, API, and human interface. Ordinary record work uses standard Queries and CRUD Actions; a
custom Action represents an explicit business transition or invariant. Reuse that same capability
for MCP or agents when needed rather than creating another implementation.

Preserve foundational identity, authorization, actor, party, and audit meaning unless the user
explicitly changes it. Keep deterministic state, permissions, invariants, idempotency, and
transactions in code. Do not hide business policy in React, rebuild gateway-owned identity flows,
or introduce a feature-flag or plugin framework merely for onboarding.

Keep the initial surface focused. Navigation may emphasize the requested operation, but do not claim
that an API or capability is disabled when it remains reachable. Prefer one working operation over
an exhaustive model or polished static demo.

When research reveals durable context that future agents would not reliably know, preserve only
the decision-changing summary in `.agents/skills/company-context/SKILL.md`. Volatile records belong
in data, assets belong beside an asset manifest, and implementation details belong in code and
tests.

## Finish with evidence

Run focused tests, `pnpm check`, and `pnpm build` after routing, bundling, or dependency changes.
Launch the owned app and exercise its primary operation through the real interface when the
environment permits, including a narrow viewport and relevant loading, empty, error, keyboard, and
permission states. Never weaken identity or authorization to make verification easier.

Report the company understanding and assumptions, the delivered operation and durable result, model
and migration changes, first-party sources and assets used, any limitation or UI-only hiding, the
path for an authorized teammate to participate, and one concrete next improvement.
