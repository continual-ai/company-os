---
name: onboard
description:
  Adapt a fresh fork to a specific company and its first operating use case, including research,
  terminology, model changes, branding, and a working vertical slice. Use for initial setup, not
  later feature work or upstream sync.
---

# Onboard

Turn the starter into the user's own operating software. Success: the company is recognizable, one
requested operation works end to end, its result is durable and reviewable, and there is a credible
next step.

Customize the existing central app and model. Do not generate a second central app; if either is
missing, the checkout is incomplete. Ask only when the answer would change the model, permissions,
destructive data work, or the first slice — otherwise assume something reversible and say so.

## Understand the company

Research first-party sources for the company's real language, audiences, and identity. Browse the
rendered site at desktop and narrow widths when visual adaptation matters; page text alone is not a
brand review. Distinguish verified facts, inferences, and user decisions.

Use an asset only when it is first-party and appropriate for the surface. Record its source URL,
retrieval date, and licensing constraint; a public URL is not permission. Never present an original
motif as an official mark or invent slogans, claims, or capabilities.

Apply identity through existing metadata, assets, and semantic tokens. Do not fork UI primitives or
start a second design system. Expressive imagery belongs on low-frequency surfaces; keep dense
tables and forms quiet and contrast verified.

## Build one governed operation

Start with the app's customization overlay for identity, navigation, and the first authenticated
experience. It is ordinary source, not a page schema.

Model the company's nouns and relationships in the portable contract, add migrations for durable
shape, and implement one governed path through persistence, Action or service, API, and interface.
Ordinary record work uses standard Queries and CRUD Actions; a custom Action is a named business
transition or invariant. Reuse that same capability for MCP and agents rather than adding a
privileged parallel path. Keep deterministic state, invariants, and transactions in code; do not
hide policy in React or add a plugin or flag framework.

Keep identity on the existing provider binding, roles, and assignments. Do not rebuild login,
invitations, or sessions when the deployment gateway owns them.

The first authenticated view should answer what the system knows, what the user can do now, and what
could come next. Give it one unmistakable primary action that leaves a persistent result another
authorized person can understand. Reveal this through the product, not a welcome tour. When
automation matters, state what starts the work, which steps run unattended, where approval is
required, how failures surface, and what outcome is recorded.

## Finish

Run focused tests and `pnpm check`, then exercise the real operation through the interface, including
narrow viewport and relevant empty, error, and permission states. Never weaken authorization to make
verification easier.

Preserve only decision-changing company context in `.agents/skills/company-context/SKILL.md`:
identity, vocabulary, priorities, sources with dates, and explicit unknowns. Not a site scrape,
asset inventory, or snapshot of volatile records.

Report the company understanding and assumptions, the delivered operation and its durable result,
model and migration changes, any limitation, and one concrete next improvement.
