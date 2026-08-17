# @continual/runtime

The reusable kernel for defining and running a Company OS. It currently owns
semantic definition primitives and a metadata projection. Execution, HTTP,
OpenAPI, MCP, and typed clients belong in this boundary as concrete slices
introduce them.

Company packages import the browser-safe definition surface from this package.
The private API composition root supplies the concrete company contract,
repositories, services, and adapters. `@continual/runtime` never imports
`@acme/*`.

The package is intentionally a single boundary while the kernel is small.
Subpath exports can isolate client, server, and platform-specific entrypoints as
real implementations appear; they do not need separate packages by default.
