# @acme/contract

Acme's source-owned semantic contract. It currently defines business objects
and UI metadata using `@continual/runtime` primitives. Actions, queries, and
policies belong here when real slices introduce them.

The contract is safe to import from browser code and build tooling. It contains
no database, secrets, provider SDKs, transport handlers, or app inventory.
Private implementations are composed in `apps/company-api`.
