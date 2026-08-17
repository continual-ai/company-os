# @acme/client

The Acme-specific client boundary. It binds the generic `@continual/client` to
the concrete `@acme/model` and will own the runtime origin, authentication
headers, and typed operations shared by Acme applications.

It is browser- and SSR-safe and must never import `@continual/runtime` or the
private implementation in `@acme/api`.
