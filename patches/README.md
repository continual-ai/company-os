# Pinned dependency fixes

- `@effect/sql-pg@4.0.0-beta.107`: register pooled-client cleanup before queueing a
  reservation. Cancellation returns promptly; a client delivered afterwards is released immediately.
  The one-connection regression test interrupts the waiter before releasing the held connection,
  then verifies the late delivery cannot exhaust the pool.
- `effect@4.0.0-beta.107`: release PostgreSQL nested savepoints after success or rollback. Without
  release, large atomic governed operations accumulate subtransaction locks and exhaust PostgreSQL
  shared memory. Other SQL dialects keep their existing behavior. The application transaction and
  seed database tests cover nested rollback, sibling isolation, and paginated fixtures.
- `nitro@3.0.260610-beta`: let requests for assets that Vite cannot serve reach Nitro's final
  middleware. Marking every image request as already handled prevented authenticated asset routes
  from running in development. Existing static files still take the normal Vite path.

These patches are applied by pnpm during installation. Recheck the behavior when updating these
packages and remove each patch once the corresponding upstream behavior is fixed.
