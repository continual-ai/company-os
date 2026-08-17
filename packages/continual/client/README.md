# @continual/client

The browser- and SSR-safe client for one deployed Company Runtime. It may
depend on `@continual/model` and oRPC client packages, but never on
`@continual/runtime`, databases, server frameworks, or `@acme/*`.

The package currently provides the HTTP bootstrap operations used for health
and model discovery. The full oRPC v2 operation surface is intentionally the
next implementation slice.

Continual Studio uses this same public client. It never receives privileged
in-process access to `@continual/runtime`.
