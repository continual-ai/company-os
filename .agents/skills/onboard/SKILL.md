---
name: onboard
description: >-
  Adapt a fresh Company OS checkout to a company and its first working process. Use for the initial
  setup prompt; use customize for individual features, later changes, and reviews.
---

# Onboard

Use [README](../../../README.md) for setup and [AGENTS.md](../../../AGENTS.md) for conventions.
Reuse supplied company facts; ask only for missing context that changes the first workflow:
who uses it, what enters it, and what useful result should persist. Do not invent a company process.

Inspect `apps/company-os/src/app.config.ts` and `app/customization` under the same source root.
Select the modules needed and adapt the existing app's identity. Keep the scope the user chose;
backend-first work can be demonstrated through the API and tests. Research only missing company
facts needed for this work. Branding is optional; when requested, use verified assets and existing
tokens, preserve provenance, and inspect the rendered result.

Use [customize](../customize/SKILL.md) to build the operation from the closest source
example. Use the host project admission provider and local attribution identities. Make deterministic rules, agent judgment,
and human decisions explicit where the workflow needs them.

Demonstrate incoming work becoming a saved result through the requested interface. Verify relevant
admission and failure states; for UI work, also check keyboard use and narrow screens. Report what
works, how the intended person or agent uses it, and remaining setup.

Preserve non-obvious company policy or vocabulary in `.agents/skills/company-context/SKILL.md` only
when future work would otherwise lose it. Keep implementation details in source and business records
in data. Do not create a context skill just to fill a template.
