---
name: onboard
description:
  Adapt a fresh or lightly customized fork to a specific company and first operating use case,
  including research, terminology, model changes, and a working vertical slice. Use for initial
  setup, not later feature work or upstream sync.
---

# Onboard

Turn the starter into the user's own operating software. Success: the company is recognizable, one
requested operation works end to end, its result is durable, and there is a credible next step.

Customize the existing `apps/company-os` and `@company/model`. Do not generate a second central
app. Use first-party evidence; ask only when the answer would change the model, permissions,
destructive data work, or first slice.

Read [references/brand-and-context.md](references/brand-and-context.md) for research and assets, and
[references/first-launch.md](references/first-launch.md) for the first authenticated experience.
Use `$architecture` only when ownership or product meaning stays unclear after reading the code.

Start in `apps/company-os/src/customization`. Put nouns and relationships in the portable model,
migrations for durable shape, and one governed path through persistence, Action or service, API,
and UI. Reuse that capability for MCP rather than adding another implementation. Keep identity on
the existing provider binding. Do not hide policy in React or invent a plugin framework.

Preserve decision-changing company context in `.agents/skills/company-context/SKILL.md` when future
agents would not otherwise know it. Finish with focused tests, `pnpm check`, and evidence of the
real operation.
