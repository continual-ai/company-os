# @company/runtime

The shared foundation for model-driven business applications: definitions, governed execution,
PostgreSQL persistence, clients, and presentation. Domain modules depend on this package; it never
imports a domain module or application. The application selects modules and supplies deployment
configuration and providers.

## Boundaries

| Import surface                     | Responsibility                                                             |
| ---------------------------------- | -------------------------------------------------------------------------- |
| `@company/runtime/model`           | Portable objects, relationships, actions, queries, and model composition   |
| `@company/runtime/server`          | Effect services for records, authorization, transactions, and events       |
| `@company/runtime/server/postgres` | SQL projection and persistence primitives                                  |
| `@company/runtime/contract/*`      | Effect Schema decoders and transport contracts shared by server and client |
| `@company/runtime/client/*`        | Browser/SSR-safe semantic clients and query caching                        |
| `@company/runtime/ui/*`            | shadcn primitives, tokens, forms, collections, record pages, and module UI |
| `@company/runtime/testing`         | Isolated PostgreSQL databases for module and integration tests             |

There is no mixed root export. The model cannot import Effect, client, server, or UI code.
Client and UI code cannot import server code; server code cannot import UI. Package exports,
Oxlint, the recursive model import check, and the application bundler enforce these boundaries.
Private source imports use `#/` with the actual extension. Public imports use declared subpaths.

## Composition

The app composes one model, server contributions, and UI contributions at separate entrypoints.
`foundationLayer(model, infrastructure)` provides the common execution services. Custom module
operations use those services directly; an app does not implement a bespoke adapter per domain.
`defineModuleServer` retains typed operation dependencies. `makeServicesLayer` binds operations to
explicit provider-layer outputs, leaving invocation and transaction state local to each call. Standard CRUD comes from the model.

`ModelUiProvider` supplies the composed model, semantic client, presentation registrations, and
host capabilities. Module components use `useObjectClient(Object)` for typed query/mutation options.
They share the application's QueryClient and server-driven invalidation. Base components can be
used without a model provider.

The PostgreSQL projection derives tables and constraints from the same model. Custom SQL uses
`ModelContext.table(Object)` and `Database.sql`. `Records.writer(Object)` retains validation and
change recording; `Database.transaction` commits business writes, search updates, and events
atomically. Applications own the deployed migration sequence and credentials.

Access and Assets are standard foundation modules, with separate portable definitions, server
implementations, and UI. Identity verification is a host-supplied `IdentityProvider` layer; the
runtime does not require Continual or another hosting platform.

See [module authoring](../../docs/modules.md) for a concrete module and isolated database tests.
The exact public surface is declared in [package.json](package.json).

```sh
pnpm --filter @company/runtime test
pnpm --filter @company/runtime typecheck
```
