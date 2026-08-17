# @continual/studio

A complete local TanStack Start application for inspecting and operating any
Continual Runtime through its public API. Studio is generic development tooling,
not the management application for a particular customer.

Studio owns its routes, model browser, generic record browser, and Tool runner.
It depends on the browser-safe `@continual/client` and `@continual/ui`; it must
never import `@continual/runtime`, a database driver, or `@acme/*`.

The `continual studio` command starts this application locally. It accepts a
Runtime URL, serves Studio on a loopback port, and keeps Runtime credentials in
the local server process. It is not mounted in or deployed with `@acme/api`.

During the dogfood phase the launcher uses Studio's Vite development server.
Before publishing the package, its production Start output will be bundled with
the package so the same command can serve prebuilt assets without a compiler.
