<h1 align="center">
  <img src="docs/images/continual-banner.png" alt="Company OS — The agent-first operating system for your business. By Continual." width="100%" />
</h1>

<h2 align="center">Build the software your business runs on.</h2>

<p align="center">
  Unify your data and operations in software you own, tailored to your business and built for agents.
</p>

<p align="center">
  <a href="https://app.continual.ai/sign-up"><strong>Try on Continual ↗</strong></a> ·
  <a href="#run-locally">Run locally</a> ·
  <a href="#the-company-model">Explore the model</a>
</p>

<p align="center"><sub>Open source · Apache 2.0 · Early preview</sub></p>

![Demo app: a support ticket connects its customer, replies, and engineering work](docs/images/record-overview.png)

## Every company will have its own operating system.

We believe every company will run on software uniquely tailored to its business, built first
for agents to operate.

For decades, building and maintaining that software was beyond the reach of most companies.
They bought standard applications, adapted their processes to fit, and connected the pieces
with integrations and manual work. Their data, rules, and operations ended up scattered across
systems they couldn’t fully change.

Agents are changing that equation. As the cost of building, customizing, and maintaining
software falls, more companies can own a system that reflects how they actually work—and
improve it as their business evolves.

That same shift changes who can do the work. Agents need connected business context, clear
rules, and ways to take action. Bring your data and operations into one system designed for
them, and agents can carry work across the business. People set direction, exercise judgment,
and shape how the system operates.

This is our vision for an AI-native company: your knowledge and processes expressed in
software you own, with people and agents working through a shared understanding of the
business. Every improvement becomes part of how your company runs.

**Company OS is the open-source foundation for building that system. Continual is the managed
platform for building, customizing, and running it.**

Start with one operation. Build toward an operating system for your company.

## Start on Continual

**[Try Company OS on Continual →](https://app.continual.ai/sign-up)**
The easiest way to get started: customize with agents, test your changes, and deploy and run
on a managed platform.

Start with one process you want to improve. For example:

> Adapt Company OS to our support process. Set response deadlines based on ticket priority,
> flag overdue tickets, and show the engineering work blocking each resolution.

Try it, refine it, and expand from there. Included sales, support, engineering, hiring, and
marketing modules give you a starting point. Every model, workflow, and screen is yours to change.

## Put your agents to work

Connect your preferred MCP-compatible agent through **Developer Center → MCP** in your app.
Agents can follow relationships, read and update records, and carry out business operations
through one API.

With the demo data, try:

> Find Northstar Robotics' open support tickets. Check the linked engineering issues and
> customer replies, then add a note summarizing what is blocking each ticket.

The notes appear on the tickets. Ask the agent to **escalate a ticket to engineering**, and
Company OS creates and links the issue through the same business rules used by the app.

Company OS provides the data and operations; your chosen agent runtime handles reasoning,
scheduling, and execution.

## The Company Model

The Company Model describes **what your business works with, how it connects, and what can
happen**. It gives your software and agents a shared understanding of the business.

| Concept        | Purpose                                         | Example                                   |
| -------------- | ----------------------------------------------- | ----------------------------------------- |
| **Objects**    | Business records and their properties           | Customers, tickets, projects              |
| **Links**      | Relationships you can follow in both directions | A ticket's company; a company's tickets   |
| **Interfaces** | Capabilities shared across record types         | Customers and tickets can both have notes |
| **Queries**    | Read records or calculate results               | Summarize the sales pipeline              |
| **Actions**    | Change records or perform work                  | Escalate a ticket to engineering          |

One model drives storage, validation, search, standard pages, and APIs. Extend it, and the
pages and APIs follow. Business rules apply whether work comes from a person, an integration,
or an agent.

## Built to be changed

Company OS is a **TypeScript, React, Effect v4, and PostgreSQL** application. You own the source
and data. Edit it directly or work with a coding agent using the included
[onboard](.agents/skills/onboard/SKILL.md) and [customize](.agents/skills/customize/SKILL.md) skills.

### Define your business

Use `defineObject`, `defineLink`, and `defineInterface` to describe your model. For example,
the [Notes module](apps/company-os/src/modules/notes/model/index.ts) defines a note and connects
it to any record implementing the `NoteSubject` interface:

```typescript
import { NoteSubject } from "#/modules/notes/model/note-subject.ts"
import { defineLink, defineObject, schema } from "#/runtime/model/index.ts"

const Note = defineObject({
  id: "note",
  collection: "notes",
  name: "Note",
  pluralName: "Notes",
  description: "Notes on conversations, decisions, or next steps.",
  properties: {
    content: schema.markdown({
      label: "Content",
      minLength: 1,
      maxLength: 10_000,
    }),
  },
  search: { fields: ["content"] },
  display: { icon: "note", title: "content" },
})

const NoteSubjects = defineLink({
  id: "noteSubjects",
  name: "Note subjects",
  from: Note,
  to: NoteSubject,
  forward: { key: "subjects", label: "Subjects" },
  reverse: { key: "notes", label: "Notes" },
})
```

Register definitions in a module and compose it in
[`app.model.ts`](apps/company-os/src/app.model.ts). Enabled objects get standard pages and APIs;
the Markdown field gets an editor automatically.

Objects come with standard read, create, update, and delete operations. Add business-specific
operations in their `queries` and `actions` fields, or disable a standard Action with `false`.
See the [escalation Action](apps/company-os/src/modules/support-engineering/model/index.ts)
and [pipeline Query](apps/company-os/src/modules/sales/model/deal.ts) for working examples.

### One API for your software and agents

The TypeScript client, HTTP API, and MCP tools expose the same object operations and business rules.
HTTP paths below are relative to `/api/v1`.

| TypeScript                        | HTTP                          | MCP                    |
| --------------------------------- | ----------------------------- | ---------------------- |
| `client.lead.list()`              | `GET /leads`                  | `lead.list`            |
| `client.lead.create(input)`       | `POST /leads`                 | `lead.create`          |
| `client.lead.convert({ id })`     | `POST /leads/{id}:convert`    | `lead.convert`         |
| `client.deal.pipelineSummary({})` | `POST /deals:pipelineSummary` | `deal.pipelineSummary` |

Explore the contracts in **Developer Center → API**. OpenAPI is at `/api/openapi`;
MCP is at `/api/mcp` and requires a client with Streamable HTTP support and credentials
accepted by your deployment.

### Customize every screen

Start with generated pages and change as much as you need:

- **Configure views:** columns, filters, sorting, boards, and calendars.
- **Fill component slots:** custom field editors, summaries, tabs, and action controls.
- **Override entire pages:** replace record or collection pages with your own React components.

Register custom UI with `defineModuleUi` in [`app.ui.ts`](apps/company-os/src/app.ui.ts).
The [Sales UI](apps/company-os/src/modules/sales/ui/index.ts) is a working example.
The shell, navigation, and branding are editable source too.

## Run locally

For local development, clone the repo. No Continual account required. You need **Node.js
24.14+ (or 25.4+), pnpm 11, and Docker** (Engine or Desktop). Compose runs PostgreSQL 18 + pgvector
on host port **5433**; the Node app stays on the host with `pnpm`.

Use a fresh local database: **`db:reset` replaces existing data in the configured database.**

```sh
git clone https://github.com/continual-ai/company-os.git
cd company-os
docker compose up -d
pnpm install --frozen-lockfile
pnpm db:reset
pnpm db:seed --scenario demo
pnpm dev
```

Open **[localhost:3002](http://localhost:3002)** and try **Support → Tickets**.
Local development signs you in automatically. Skip the seed command to start without demo data.

The default database is `postgresql://localhost:5433/company_os`. Configure overrides in
`.env.local` using [`.env.example`](apps/company-os/.env.example). See the
[development guide](docs/development.md) for making changes and the
[deployment guide](docs/deployment.md) for retained data, migrations, and production setup.

---

Company OS is **[Apache 2.0](LICENSE)**. Self-host, customize it for your company, or build a
product of your own. Built by [Continual](https://continual.ai).
[Feedback and contributions welcome](https://github.com/continual-ai/company-os/issues).

**[Build your Company OS on Continual →](https://app.continual.ai/sign-up)**
