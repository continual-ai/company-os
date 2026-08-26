# @company/ui

Design tokens and application components maintained in this repository.

The package keeps applications visually coherent while leaving each app responsible for its
own pages and product decisions. Components are editable shadcn primitives built on Tailwind CSS v4.

```ts
import { Button } from "@company/ui/components/button"
import { cn } from "@company/ui/lib/utils"
```

Import the global theme from each app's local Tailwind entry so the app owns its source scan and
any app-specific styles:

```css
@import "@company/ui/globals.css";

@source "../**/*.{ts,tsx}";
```

Add a shared primitive with `pnpm ui:add <component>` from the repository root.

## Boundaries

- Put durable tokens and the curated shadcn-derived component layer here.
- Build opinionated product patterns in the owning app first. Promote a pattern into a deliberate
  `@company/ui/patterns/*` export only after concrete use establishes stable semantics across apps.
- Keep page composition and one-app components with the owning app.
- Keep business objects, API definitions, data fetching, and server behavior out of this package.
- Add explicit package exports for each public component or utility.
