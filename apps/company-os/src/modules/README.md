# App-owned modules

Support is an app-specific domain. It uses the same `model/`, `ui/`, and `seeds/` structure as the
source-owned packages in the repository's `modules/` directory. Access and Assets implementation
live in `@company/runtime`; the remaining Assets files here test the composed application.

The application composes portable definitions in `src/app.model.ts`, custom operations and layers
in `src/app.server.ts`, and presentation in `src/app.ui.ts`. Cross-domain demo scenarios live
in `src/examples/`; fixture implementations and assets stay in their owning modules.

The optional Support–Engineering bridge owns the cross-domain link, escalation receipt, custom
action, and React workflow page. Support itself does not import Engineering.

Follow [Building a module](../../../../docs/modules.md) for package authoring and independent tests,
and [Architecture](../../../../docs/architecture.md) for policy and ownership boundaries.
