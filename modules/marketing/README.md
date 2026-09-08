# @company/marketing

Campaigns, content, enrollments, and outreach.

`/model` and `/ui` contribute ordinary definitions and presentation. Contacts are an explicit dependency on Sales. Standard persistence and operations are supplied by the composed model.

This is editable source-owned application code. It never imports `apps/company-os`. Install its
contributions explicitly at the application's model, server, and UI roots as needed.

Run `pnpm --filter @company/marketing test` from the repository root. Database tests require PostgreSQL and create isolated disposable databases with the shared testing helper.
See [module authoring and testing](../../docs/modules.md) for the contract and database setup.
