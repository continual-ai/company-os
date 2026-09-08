# @company/sales

Companies, contacts, leads, deals, and sales activity.

`/model` owns definitions. `/server` registers conversion and pipeline aggregation using shared
runtime services. `/ui` exports `SalesUi`, whose components use the typed semantic client from the
runtime UI provider. The application installs these contributions without implementing Sales ports,
callbacks, or business rules.

This is editable source-owned application code. It never imports `apps/company-os`.

Run `pnpm --filter @company/sales test` from the repository root. The test composes the Sales model
and its dependencies, creates an isolated PostgreSQL database, and uses the real runtime foundation
to exercise authorization, conversion, events, and scoped SQL aggregation without the app.
See [module authoring and testing](../../docs/modules.md).
