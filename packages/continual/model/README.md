# @continual/model

Browser-safe, type-safe primitives for defining a Company Model: Objects,
Tools, Modules, Apps, and Projects.

This package is reusable Continual framework code. It must never import
`@acme/*`, database drivers, server frameworks, filesystem APIs, or private Tool
implementations. A customer-specific package such as `@acme/model` uses these
primitives to define its public model.
