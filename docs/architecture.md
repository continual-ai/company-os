# Architecture

Company OS is a modular TypeScript application in which people, applications, integrations, and
agents use the same business meaning and governed capabilities. The central application is the
authority for business behavior and records; HTTP, OpenAPI, typed clients, MCP, and user interfaces
are projections over that implementation rather than independent systems.

## Packages and applications

| Source                                                    | Responsibility                                                                          | May depend on                      |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------- |
| [`@company/runtime`](../packages/runtime/README.md)       | Portable definitions plus reusable execution and transport machinery                    | External libraries only            |
| [`@company/model`](../packages/model/README.md)           | Browser-safe company objects, relationships, queries, actions, and shared metadata      | `@company/runtime`                 |
| [`@company/postgres`](../packages/postgres/README.md)     | Server-only PostgreSQL schema and repository implementation                             | `@company/runtime`                 |
| [`@company/ui`](../packages/ui/README.md)                 | Shared visual primitives and design tokens                                              | Presentation libraries only        |
| [`company-os`](../apps/company-os/README.md)              | Central UI, authorization, business services, transactions, persistence, and transports | All reusable packages              |
| [`base`](../templates/base/README.md)                     | Minimal starter for any optional application                                            | Browser-safe model and UI packages |
| [`client-portal`](../templates/client-portal/README.md)   | Customer-facing interface over deliberately exposed capabilities                        | Browser-safe model and UI packages |
| [`marketing-site`](../templates/marketing-site/README.md) | Public content and entry points into the other applications                             | Browser-safe model and UI packages |

The package manifests and boundary checks are authoritative for exact dependencies and public
exports. The table explains why those boundaries exist.

## Authority and request flow

```text
human UI        integrations        agents
    \                |                /
     +---------------+---------------+
                     |
              typed client / HTTP / MCP
                     |
        verified identity and invocation context
                     |
       governed object services and custom actions
                     |
          authorization and repositories
                     |
                  PostgreSQL
```

The model describes the shared contract. The central application binds every query and action to
authorization and an implementation. Repositories preserve persistence and transaction invariants.
Transport handlers decode and project calls but do not reimplement business behavior.

Client capability checks are advisory. The server enforces authorization, validation, audit
attribution, and transactional rules again for every operation, regardless of caller.

## Source ownership

Cloning or forking the repository creates one project with one `@company/model` and one required
`apps/company-os` composition root. `templates/*` contains maintained executable starters only for
optional focused apps. `pnpm app:create <template>` copies one under `apps/*`, gives it its ordinary
package identity, installs the workspace, and runs its bootstrap checks. The added app is then
ordinary company-owned source. It never imports template source, so a company can change it without
creating a second extension system.

The stable `@company/*` namespace identifies reusable source packages; it is not replaced with a
company name. Product identity belongs in model metadata and application customization source.

## Where a change belongs

The paths below describe a Company OS project. Optional app starters remain under `templates/*`;
the central application is always ordinary source under `apps/company-os`.

| Change                                                             | Start here                          |
| ------------------------------------------------------------------ | ----------------------------------- |
| Add or change business vocabulary or a governed operation          | `packages/model`                    |
| Implement business rules, authorization, or orchestration          | `apps/company-os/src/server`        |
| Change application identity, navigation, or the initial experience | `apps/company-os/src/customization` |
| Add generic model execution or protocol machinery                  | `packages/runtime`                  |
| Add reusable PostgreSQL behavior                                   | `packages/postgres`                 |
| Add a shared presentation primitive                                | `packages/ui`                       |
| Build a workflow used by one interface                             | The owning app                      |

Start with one complete operation. Identify its incoming work, desired outcome, authoritative
records, deterministic rules, permitted judgment, human decisions, failure behavior, and evidence
of success before introducing new layers or generic framework surface.
