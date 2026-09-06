# Company modules

Each folder owns its business definitions, private server behavior, and specialized presentation.
`src/model.ts` composes the browser-safe definitions; the server assembly binds custom Effect
operations. Standard services, storage projections, API contracts, and default UI derive from that
model. These modules are source-owned starting points that a company can freely modify.

Start with `<domain>/<object>/model.ts`. Custom operations live in that object's `server/` directory;
React components live in `ui/`, with registrations in `ui/config.ts`. Module-level `model.ts`,
`server.ts`, and `ui.ts` compose contributions. Links and interfaces have one definition each in
module-level `links/` and `interfaces/` directories. Standard objects need only their model file.

Follow [Building a module](../../../../docs/modules.md) for the authoring path and
[Architecture](../../../../docs/architecture.md) for data, policy, and ownership boundaries.
Engineering connects projects, repositories, issues, and pull requests. Marketing owns campaigns,
content, enrollments, and outreach. Support owns tickets and replies, linked to engineering issues.
These are editable records, not installed automation runtimes.

Sales demonstrates a transactional lead conversion, scoped SQL report, and multiple affiliations; Assets demonstrates a complete module
with portable actions, server implementation, and a reusable UI control.
