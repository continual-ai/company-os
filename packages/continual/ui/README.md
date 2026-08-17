# @continual/ui

Reusable React primitives for Continual products and custom applications. It
contains design-system components, model-aware controls, and presentation
helpers, but no application routes, API handlers, authentication policy, or
customer-specific branding.

`@continual/studio` is one consumer of this package. Customer applications may
also compose these components with their own design system; using Continual
does not require adopting this UI package.

This package is browser-safe. It must never depend on `@continual/runtime`,
`@continual/studio`, `@continual/cli`, or `@acme/*`.
