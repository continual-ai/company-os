# Pinned dependency fixes

- `effect@4.0.0-rc.116`: release PostgreSQL nested savepoints after success or rollback. Without
  release, large atomic governed operations accumulate subtransaction locks and exhaust PostgreSQL
  shared memory. Other SQL dialects keep their existing behavior. The application transaction and
  seed database tests cover nested rollback, sibling isolation, and paginated fixtures.

These patches are applied by pnpm during installation. Recheck the behavior when updating these
packages and remove each patch once the corresponding upstream behavior is fixed.
