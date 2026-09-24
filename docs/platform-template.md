# Company OS on Continual: template pilot

This branch provides two testable slices of the proposed boundary. Company OS owns its model,
business records, operations, results and UI. Continual owns identity, authorized Connections,
agent execution and deployment. It is not a replacement for every existing controller.

## What runs where

- App requests use `@continual/sdk/app` for platform identity. The template no longer invents
  project-admission claims or silently signs development requests in as a local user.
- PostgreSQL stores the model and durable business work. The App uses request-scoped runtimes on
  Workers and polls the durable event journal instead of opening a session-bound LISTEN connection.
- Contact briefs run in a Branch-scoped platform Automation. They do not depend on the App process
  staying alive or waiting for `agent.run().result()`.
- GitHub repository metadata is fetched using the App's request-bound SDK and a Project Connection.
  An App operation validates and applies the upstream snapshot. OAuth grants stay on Continual.
- The standalone Node controller host is opt-in with `COMPANY_OS_CONTROLLER_HOST=true`. Existing
  full GitHub discovery/issue/PR sync and automatic contact-change watchers still belong to that
  host. Do not enable its contact-summary controller alongside this pilot for the same contacts.

## Import and publish a test Branch

Use `codex/platform-app-template` as the source for a disposable Continual Project/Branch. Keep
existing Company OS data separate: the repository is pre-v1 and updates its single model-derived
initial migration. This branch does not migrate your existing deployed database.

1. Run `pnpm install`. Node and pnpm requirements are in the root package manifest.
2. Let Continual supply `DATABASE_URL`, optional `DATABASE_SCHEMA`, `APP_SECRET` and runtime identity
   bindings. Do not copy a preview execution token into production secrets. The normal App SDK
   contract must work in preview and published requests.
3. Apply the model to the new database with `pnpm db:migrate`. Use `pnpm reset` only for disposable
   data. Database migrations are app-owned and are not automatically applied by publishing.
4. Set `VITE_APP_URL` to the App's stable URL before building. Company OS validates MCP Host and
   Origin against this URL. Keep the platform callback URL reachable from published Workers.
5. Build and publish through `pnpm deploy`. Enable CRM (and Engineering for the GitHub pilot).
6. Refresh the MCP catalog. Confirm `contact.requestBrief`, `contactBrief.begin`,
   `contactBrief.complete`, `contactBrief.fail` and `githubRepository.applySnapshot` are present.
   Output schemas are preserved. Caches contain only immutable model contracts and schemas;
   actor identity and module activation remain request-dependent.

## Contact brief pilot

From an agent sandbox in the **same Branch**, run:

```sh
pnpm --dir apps/company-os platform:setup
```

This creates or updates one manual Automation named `Company OS: contact briefs`. It follows
pagination, refuses ambiguous duplicate names, and prints its ID and Branch. Run setup serially.
To enable polling every five minutes, run:

```sh
pnpm --dir apps/company-os platform:setup --schedule
```

The platform chooses the Branch from the sandbox execution credential. The template contains no
Project, Connection or Automation IDs. Keep required project skills/connections and App access
available to the Automation. Setup requires the platform Automation builder tools. An ordinary App
request does not need permission to create Automations.

Create a contact and notes, then use **Request brief** on its generated record page or call
`contact.requestBrief` with `{id, requestKey}`. Reuse a request key on retries; use a new key for a
new request. Invoke the returned Automation ID with `automations_run` to test immediately.

The worker calls `contactBrief.begin`, which returns the current contact, affiliations, accounts,
activities and their notes, following all pages. Its revision covers the source IDs and etags.
It claims work for 15 minutes and records the execution Thread ID. Overlapping workers cannot
complete with an old lease. Expired work can be reclaimed by a later invocation.

Completion updates the summary and work result in one database transaction. A source change
observed at completion marks work stale and preserves the existing summary. Retrying an identical
completion is safe. Failed work stores a short error; retries use a new request key. The generated
Contact briefs page shows status, result, error and execution reference without scraping a transcript.
The first pilot queues explicit requests; it does not automatically queue a brief after every note
change. Module disablement removes these MCP operations; pause its Automation separately.

Test: edit a note after `begin` and before `complete`; the result must be stale. Expire/reclaim a
lease and try the former token; it must fail. Retry the same successful completion; no new work or
summary write should occur.

## Managed GitHub connection pilot

Attach an authorized GitHub Connection in the Project. In Company OS, create a GitHub Connection
record with its account and `platformConnectionId`; no App-local token is needed for this path.
Create a GitHub repository record linked to that connection using the real GitHub node ID, full
name and URL returned by `get_repository`.

Grant the App `get_repository` on that exact Project Connection. With a signed-in App request:

```js
await fetch(`/api/integrations/github/${repositoryId}`, { method: "POST" })
```

The endpoint verifies project admission and module activation, reads one repository through the
platform SDK, then applies a validated snapshot. It rejects a different source node ID or changed
repository configuration, ignores older/repeated upstream versions, and preserves local project
links and ownership. It does not import issues/PRs, run a schedule, or send messages to GitHub.
The existing standalone token fields/controllers remain for the standalone host; this pilot does
not use them. Do not run both sync paths on one repository.

## Platform requirements and remaining work

These pilots use shipped SDK and Automation APIs. No new platform database resource, Remote MCP
registration, agent callback service or custom OAuth flow is needed.

The local Continual changes from the deployment investigation are still relevant: a 30-second
MCP discovery budget and Refresh that actually re-discovers and saves the current deployment's
catalog. They live in the platform repository, separately from this branch. This template also
bundles React for Workers, pins the newer CLI/SDK, and caches MCP schema conversion.

A fuller migration needs managed deterministic jobs with keyed concurrency, retries, leases and
scheduled resume; durable business-event delivery; and reconciliation of module activation with
its platform Automations and permissions. The platform's agent Automations are not an arbitrary
code-job API. The bounded GitHub route deliberately does not claim to replace that infrastructure.
A public actor-kind field in the SDK would also remove the current adapter's dependency on the
platform's `sa_` service-account prefix.

## Verification

```sh
pnpm check
pnpm test
pnpm build
RUN_E2E_TESTS=1 pnpm --dir apps/company-os exec vitest run --project platform-live
```

Database tests create isolated databases using the supplied development `DATABASE_URL` and clean
them up. The opt-in live test requires a short-lived `COMPANY_OS_TEST_RUNTIME_ASSERTION`,
`COMPANY_OS_TEST_CONNECTION_ID`, `COMPANY_OS_TEST_REPOSITORY`, `CONTINUAL_URL` and
`CONTINUAL_PROJECT_ID`. Supply the assertion through a development test runner; never commit it.
It proves SDK identity and a real read-only GitHub connector call, not a new Cloudflare publication
or a full model-generated brief. Those final acceptance checks must run in the imported test Branch.
