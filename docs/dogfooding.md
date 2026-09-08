# Engineering and support dogfooding

The starter runs with Access and Assets only. Install business capabilities by editing three source
composition roots. The reusable domains remain source-owned packages; Support and its Engineering
integration stay local to this application. No package publishing or plugin loader is required.

## Install the workflow

In `apps/company-os/src/app.model.ts`, keep the existing foundation imports and add:

```ts
import { EngineeringModule } from "@company/engineering/model"
import { NotesModule } from "@company/notes/model"
import { SalesModule } from "@company/sales/model"
import { SupportModule } from "#/modules/support/model/index.ts"
import { SupportEngineeringModule } from "#/modules/support-engineering/model/index.ts"
```

Set the `modules` array in `defineModel` to:

```ts
modules: [
  AccessModule,
  AssetsModule,
  NotesModule,
  SalesModule,
  EngineeringModule,
  SupportModule,
  SupportEngineeringModule,
]
```

Support uses Sales' company/contact records and Notes' shared discussion contract. Engineering and
Support do not depend on each other. Their optional bridge owns the ticket-to-issue link and the
escalation operation. Marketing and its fixtures are not installed by this composition.

In `app.server.ts`, add `SalesServer` from `@company/sales/server` and
`SupportEngineeringServer` from `#/modules/support-engineering/server/index.ts`, then use:

```ts
export const serverModules = [
  AccessServer,
  AssetsServer,
  SalesServer,
  SupportEngineeringServer,
] as const
```

In `app.ui.ts`, add the UI exports from each installed module:

```ts
import { EngineeringUi } from "@company/engineering/ui"
import { NotesUi } from "@company/notes/ui"
import { SalesUi } from "@company/sales/ui"
import { SupportUi } from "#/modules/support/ui/index.ts"
import { SupportEngineeringUi } from "#/modules/support-engineering/ui/index.ts"

export const modelUi = composeModelUi(
  Model,
  AccessUi,
  AssetsUi,
  NotesUi,
  SalesUi,
  EngineeringUi,
  SupportUi,
  SupportEngineeringUi
)
```

These package dependencies are already available in this checkout. On a disposable starter database,
regenerate the initial baseline and start a separate database:

```sh
pnpm --filter company-os db:generate --baseline
pnpm format
DATABASE_URL=postgresql://localhost:5432/company_os_engineering_support pnpm dev
```

Supply your own PostgreSQL user/endpoint if needed. The old minimal database remains untouched.
Once you retain dogfooding records, preserve that baseline and add numbered migrations using the
[database guide](runbooks/database.md). Removing modules from the TypeScript list never deletes tables.

## Run one operation

1. Create a Support ticket with a concrete customer problem and priority.
2. Open **Engineering escalations** and choose **Create engineering issue** for that ticket.
3. Follow the resulting issue. Its title, description and priority come from the ticket, and its
   initial status is Backlog. Assign an owner and work the issue through your engineering process.
4. Retry the escalation, including from the generated `escalation.createIssue` MCP tool. The same
   issue is returned. The ticket's Issues relationship and escalation receipt preserve the handoff.
5. Resolve the customer problem explicitly in Support. Engineering work does not automatically close
   a ticket; a person decides whether the customer outcome is complete.

Only open tickets can start an escalation. The caller needs the escalation action, access to the
ticket, and permission to create an issue. Existing receipts additionally require access to the
linked issue. The transaction records normal changes plus the `escalation.ticketEscalated` fact.
Failure rolls back the issue, association, receipt, and events together.

The escalation collection uses a module-owned React page with the semantic client. Customize that
page for your triage process; shared routes contain no ticket or issue branches. Its initial queue
shows up to 50 open tickets; use Support's full collection for broader search and filtering.

## Verify before retaining data

```sh
pnpm check
pnpm turbo run test --force
pnpm build
```

The suite covers missing module dependencies, a Support-only model, concurrent escalation retries,
authorization, closed-ticket rejection, transaction rollback, and HTTP-to-MCP retry parity. It also
checks the committed baseline, immutable history, and a numbered migration that retains rows.

Local development supplies an administrator. For real users, configure the
[production identity adapter](runbooks/deployment.md#standalone-jwt-identity), bootstrap the first
administrator, and assign local roles before inviting the team. No notification, issue-tracker sync,
or outbound customer message is sent by the sample workflow.
