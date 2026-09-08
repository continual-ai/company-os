# @company/engineering

Projects, repositories, issues, and pull requests.

`/model` and `/ui` contribute definitions and presentation. Engineering depends on Access and Notes, and works without Sales or Marketing. Standard persistence and operations are supplied by the composed model.

This is editable source-owned application code. It never imports `apps/company-os`. Install its
contributions explicitly at the application's model, server, and UI roots as needed.

Run `pnpm --filter @company/engineering test` from the repository root. Database tests require PostgreSQL and create isolated disposable databases with the shared testing helper.
See [module authoring and testing](../../docs/modules.md) for the contract and database setup.
