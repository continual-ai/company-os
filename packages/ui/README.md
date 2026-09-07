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

## Visual conventions

Keep structure crisp and controls gently rounded. The shared `--radius` is 8px by default;
Tailwind's `rounded-sm`, `rounded-md`, `rounded-lg`, and `rounded-xl` resolve to 4, 6, 8,
and 12px. Set `--radius` once in an application's theme to adjust the scale.

- Use `rounded-md` for buttons, inputs, selects, and navigation highlights, at every size.
- Use `rounded-sm` for small badges and checkboxes, `rounded-lg` for cards and floating
  menus, and `rounded-xl` for dialogs and the command palette.
- Keep adjoining panels, table cells, range interiors, and edge-attached sheets square.
  Circular avatars, switches, and status dots retain their semantic shapes.
- Use borders and quiet surface changes for grouping. Reserve elevation for floating
  surfaces; ordinary cards and toolbar controls do not need shadows.
- Keep operational views compact. Settings and forms can use more spacing without changing
  the shared control geometry. Preserve visible focus, selected, invalid, and disabled states.

Primitives own these defaults; consumers should normally pass layout classes only. Normalize
newly generated components to these conventions rather than adding page-specific corrections.
The app's Developer Center → Design system → Foundations demonstrates the scale and controls.

## Code examples

Use the shared code renderer for read-only examples:

```tsx
import { CodeBlock } from "@company/ui/components/code-block"

export function QueryExample({ code }: { code: string }) {
  return <CodeBlock label="List companies" language="tsx" code={code} />
}
```

It provides copy feedback, keyboard-accessible horizontal scrolling, and light/dark syntax colors.
Plain text renders immediately, including during SSR; a shared Shiki highlighter loads asynchronously.
The focused bundle supports TSX, TypeScript, JSON, Bash, and SQL; omit `language` for plain text.
Code is rendered as React text tokens, never executable markup. This component is for snippets,
not editing or virtualized file browsing.

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

Markdown source editing and reading share the same CommonMark/GFM renderer. The editor is
controlled; consumers retain ownership of drafts and submission. It supports selection formatting,
keyboard shortcuts, and a preview. Raw HTML is disabled, and external images render as explicit
links instead of loading automatically. Domain-specific attribution and actions belong to the app.
