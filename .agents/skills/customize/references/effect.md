# Effect v4

Check the installed Effect version and source before adopting an API from memory. This repository
uses v4; the [official services migration guide](https://github.com/Effect-TS/effect/blob/main/migration/services.md)
explains the service and layer changes.

- Use `Context.Service` with an effectful `make` constructor for dependencies that need substitution
  or acquisition. Define `static readonly layer = Layer.effect(this, this.make)` explicitly: v4 does
  not generate `.Default`. Use `.layerTest` or `.layerConfig` for variants, not `Live` exports.
- Read dependencies with `yield* Service`. Use named `Effect.fn` for business operations and infer
  their requirements. Pure calculations stay ordinary TypeScript; a helper needs no service tag.
- Wire dependencies with `Layer.provide`; use `Layer.provideMerge` only when callers also need the
  provider. Reuse layer values within a composition. Keep `ManagedRuntime` and `runPromise` at host
  boundaries. Never capture an invocation, transaction, or arbitrary ambient Context in a constructor.
- The server entrypoint exposes `Database`, `OperationExecutor`, `EventJournal`, and `defineModuleServer`.
  Use `database.repository(Object)` for CRUD and atomic `links` changes; use `database.table(Object)`
  and `database.sql` for SQL. Raw storage services are kernel implementation details.
- Bind server contributions with `defineModuleServer(Module, { operations, controllers, layer })`
  in the module's `server/index.ts`, and register it once in `app.server.ts`. `operations` is the
  client-shaped handler map; `controllers` contains `defineControllerServer` bindings; optional
  `layer` supplies Effect services for both. Keep contracts in `model/` and matching implementations
  in `server/`. Handler requirements remain inferred until the application supplies their providers.
  The executor checks admission, validates
  contracts, and owns Action transactions and read-only Queries. Internal composition uses repositories
  or shared functions. Use `database.transaction` for atomic work outside an operation. It joins an
  existing transaction; it does not create a savepoint or roll back an inner failure you catch.
- Public operation schemas enforce editable fields; repositories enforce data invariants for every
  caller and allow internal writes to output-owned fields. HTTP, MCP, and clients derive from the same
  operation contracts. Keep adapter-specific behavior at their boundaries.
- Keep typed expected failures in the error channel; reserve defects for broken server invariants.
  Acquire resources with scoped Effect APIs. External I/O needs an explicit commit/retry boundary;
  do not add remote calls inside a database Action without considering its transaction lifetime.

Follow `modules/sales/server/convert-lead.ts` for operation composition and
`runtime/server/foundation.ts` for service assembly (paths relative to `apps/company-os/src/`).
