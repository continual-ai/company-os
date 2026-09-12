# UI customization

Paths below start at `apps/company-os/src/`.

Enabled objects automatically get internal collection/record pages, forms, and navigation, after
project admission. `app.ui.ts` is optional presentation customization, not an activation requirement.
Public intake is a separate surface; a request for Company OS without a public site still includes
its standard internal pages.

Module UI uses `useObjectClient(Object)` from `runtime/ui/module.ts`; shell code uses
`app/app-client.ts`. Use the existing forms, error paths, and server-driven invalidation. Prefer
`defineModuleUi` additions/replacements, then a module-owned page for a distinct workflow. Do not
create a custom route, transport, or service merely to expose standard CRUD.

For a missing object, check model registration, enablement, database setup, and project admission
before adding UI code. Demo seeding is optional sample data. Reload the app and verify the intended
user's access.
