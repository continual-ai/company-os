# @acme/ui

Acme's shared design tokens and application components.

The package keeps the three apps visually coherent while leaving each app responsible for its own
pages and product decisions. Components are source-owned shadcn primitives built on Tailwind CSS
v4.

```ts
import { Button } from "@acme/ui/components/button"
import { cn } from "@acme/ui/lib/utils"
```

Import the global theme from each app's local Tailwind entry so the app owns its source scan and
any app-specific styles:

```css
@import "@acme/ui/globals.css";

@source "../**/*.{ts,tsx}";
```

Add a shared primitive with `pnpm ui:add <component>` from the repository root.

## Boundaries

- Put durable tokens and genuinely shared primitives here.
- Keep page composition and app-specific components with the owning app.
- Keep business objects, API definitions, data fetching, and server behavior out of this package.
- Add explicit package exports for each public component or utility.

## Current state

The package exports the global theme, a class-name helper, and a small form/control set: Button,
Checkbox, Input, Label, and Textarea.
