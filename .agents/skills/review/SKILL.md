---
name: review
description:
  Run a strict maintainability audit of the current branch for abstraction quality, file sprawl, and
  spaghetti growth. Use for a deep code quality review, harsh maintainability review, or the
  thermo-nuclear review.
disable-model-invocation: true
---

# Review

Audit the current branch's changes for structure, not behavior. Preserve behavior; make the
implementation dramatically simpler, smaller, and more direct. Be thorough and demanding. Measure
twice, cut once.

Be ambitious. Do not stop at local cleanup. Look for the restructuring that deletes whole branches,
helpers, modes, or layers — the version that feels inevitable in hindsight. Prefer deleting
complexity over rearranging it.

## Presumptive blockers

- A plausible reframing would delete a category of complexity, and the change keeps it.
- The diff pushes a file from under 1000 lines to over it without a compelling structural reason.
- New ad-hoc conditionals or special cases are bolted into unrelated flows.
- Feature-specific logic is scattered into shared paths, or logic sits in the wrong package or layer.
- An unnecessary wrapper, magical generic mechanism, or cast-heavy contract makes the design more
  indirect.
- Unnecessary `any`, `unknown`, optionality, or silent fallback papers over an unclear invariant.
- A near-duplicate of an existing canonical helper.
- Independent work is serialized for no reason, or related updates can leave state half-applied.

Correct behavior is not sufficient for approval. If none of the above hold and there is no obvious
missed decomposition, approve.

## Remedies to push for

Delete a layer instead of polishing it. Reframe the state model so conditionals disappear. Move the
concept to the package that already owns it. Replace condition chains with a typed model or explicit
dispatch. Separate orchestration from business logic. Turn special cases into a simpler default
flow. Make a type boundary explicit so control flow gets simpler.

## Output

Lead with structural regressions and missed simplifications, then boundary and type problems, then
file size and legibility. Prefer a few high-conviction comments over a list of nits. Be direct and
serious without being rude: say clearly when a change makes the codebase messier, and do not soften
a structural problem into "maybe rename this."
