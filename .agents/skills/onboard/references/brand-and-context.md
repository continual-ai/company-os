# Brand and company context

Read this reference when onboarding depends on public company research, visual identity, reusable
assets, or durable company context.

## Research from evidence

Use search and web research to find authoritative first-party language and candidate assets. Browse
the rendered site as well: inspect the home page and the few pages relevant to the requested
operation at desktop and narrow widths, allowing motion and lazy-loaded media to appear. Evaluate
hierarchy, typography, spacing, color, imagery, motion, and transitions. Page text or CSS alone is
not a visual brand review.

Look for one unusually recognizable first-party visual asset or motif. Prefer a reusable SVG,
image, WebM, or MP4 over copying a marketing runtime. Do not crawl the whole site, treat screenshots
as reusable assets, or adopt an elaborate effect simply because it exists.

Use an asset only when it is first-party, relevant, compatible with the product experience, and
appropriate for the surface. Keep a local production copy when allowed and record its source URL,
retrieval date, intended use, and known licensing constraint in a small manifest. A public URL is
not evidence of unrestricted reuse.

## Adapt within the product grammar

Keep the source-owned component system, Geist typography, density, shell behavior, forms, tables,
and accessibility conventions. Apply identity through existing metadata, assets, and semantic
tokens rather than forking primitives or creating another design system.

- Prefer official marks, colors, typography information, and a few relevant first-party visuals.
- Map a restrained company palette to semantic roles while retaining neutral operational surfaces
  and verified contrast.
- Use expressive imagery on low-frequency surfaces such as the first authenticated view or a
  deliberate empty state; keep dense tables and forms quiet.
- When first-party material is sparse, create one restrained original motif only if it materially
  improves recognition. Never present it as an official mark.
- Update visible identity, metadata, favicon, and copy from the same verified source. Avoid invented
  slogans or claims.

Do not recreate login, invitations, sessions, or credential administration when the deployment
gateway owns them. If the fork owns a sign-in surface, make it consistent with the company identity
without allowing it to become the only branded experience.

## Preserve only durable context

When future decisions would otherwise lose important context, create or update
`.agents/skills/company-context/SKILL.md` with the company's current identity, audiences, preferred
vocabulary, initial operating priorities, authoritative source links and retrieval dates, a pointer
to the asset manifest, and explicit unknowns or inferences.

Do not turn that skill into a website scrape, asset inventory, employee directory, model duplicate,
or snapshot of volatile operating records.
