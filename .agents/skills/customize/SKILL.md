---
name: customize
description:
  Change an established fork's model, governed capabilities, workflows, integrations, branding, or
  interface. Use after onboarding, including whether work belongs in the central app or an optional
  app. Not for initial discovery or merging upstream.
---

# Customize

Make company-specific changes through the narrowest authoritative surface. Keep people, agents, and
external interfaces on the same governed capabilities.

Inspect the code, tests, and `.agents/skills/company-context/SKILL.md` when it exists. Restate the
outcome in the company's language, then classify: durable meaning, governed execution, projection,
or experience. Use `$architecture` only when ownership or semantics cannot be resolved from that.

Ordinary record work uses standard Queries and CRUD Actions. A custom Action is a named transition
or invariant. Put policy in one capability and project it; do not make React, MCP, or a job the
authority. For automation, reuse the same actions other callers use. Branding stays in existing
tokens and assets.

Enable/disable means hide, deny, stop work, exclude from a deployment, or retire data — pick the
true boundary. Do not delete migrations as deactivation, and do not call a hidden API "disabled."

Verify the authoritative behavior and each affected projection. Run focused tests and `pnpm check`.
