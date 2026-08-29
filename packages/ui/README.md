# @company/ui

Shared design tokens and presentation primitives for Company OS applications. The package keeps
applications visually coherent while leaving each app responsible for its pages, workflows, and
product decisions.

Components are editable shadcn primitives built on Tailwind CSS v4:

```ts
import { Button } from "@company/ui/components/button"
import { cn } from "@company/ui/lib/utils"
```

Import the global theme from each app's local Tailwind entry so the app owns source scanning and
app-specific styles:

```css
@import "@company/ui/globals.css";

@source "../**/*.{ts,tsx}";
```

## Add a primitive

Run the source-owned shadcn generator from the repository root:

```sh
pnpm --filter @company/ui exec shadcn add <component>
```

Add an explicit package export for every public component or utility. Keep opinionated product
patterns in the app that owns them until concrete use proves a stable cross-application primitive.

## Boundaries

- Put durable visual tokens and shared presentation mechanics here.
- Keep page composition, business workflows, and one-app components with the owning app.
- Keep business objects, API definitions, data fetching, persistence, and server behavior out of
  this package.

Read the [architecture guide](../../docs/architecture.md) for the complete application and package
ownership model.

## Develop

From the repository root:

```sh
pnpm turbo run typecheck --filter=@company/ui
```
