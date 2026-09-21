import { Deferred, Effect, Exit } from "effect"
import { expect } from "vitest"

import { Project, Task, WorkModule } from "#/modules/work/model/index.ts"
import { ServiceAccount, User } from "#/runtime/access/model/index.ts"
import {
  CalendarDate,
  EmailAddress,
  defineModel,
  modelObjectLinkTraversals,
} from "#/runtime/model/index.ts"
import { PlatformModule } from "#/runtime/platform/model/index.ts"
import { EventJournal } from "#/runtime/server/events/event-journal.ts"
import { Database } from "#/runtime/server/index.ts"
import { Links } from "#/runtime/server/storage/link-store.ts"
import { testFoundation } from "#/runtime/testing/foundation.ts"

const fixture = testFoundation(
  defineModel({
    name: "Work test",
    modules: [PlatformModule, WorkModule],
  })
)

fixture.test(
  "coordinates standalone work and nested project work with human and agent owners",
  () =>
    Effect.gen(function* () {
      const db = yield* Database
      const tasks = db.repository(Task)
      const user = yield* db.repository(User).create({
        name: "Engineer",
        email: EmailAddress("engineer@example.test"),
      })
      const agent = yield* db
        .repository(ServiceAccount)
        .create({ name: "Planning agent" })
      const project = yield* db
        .repository(Project)
        .create({ name: "Workshop", links: { owner: user.id } })
      const parent = yield* tasks.create({
        title: "Electrical installation",
        links: { project: project.id, owner: user.id },
      })
      const child = yield* tasks.create({
        title: "Review design",
        acceptanceCriteria: "Accepted drawing revision",
        links: { parent: parent.id, project: project.id, owner: agent.id },
      })
      const leaf = yield* tasks.create({
        title: "Check clearances",
        links: { parent: child.id },
      })
      const standalone = yield* tasks.create({
        title: "Review maintenance exceptions",
      })
      expect(standalone.links.project).toBeNull()
      expect(
        (yield* tasks.get({ id: child.id, expand: true })).links
      ).toMatchObject({
        parent: { id: parent.id },
        owner: { id: agent.id },
        subtasks: { items: [{ id: leaf.id }] },
      })
      // Removal is not a cascade, and hierarchy does not silently reassign project ownership.
      yield* tasks.delete({ id: parent.id })
      expect((yield* tasks.get({ id: child.id })).links).toMatchObject({
        parent: null,
        project: project.id,
      })
      yield* db.repository(Project).delete({ id: project.id })
      expect((yield* tasks.get({ id: child.id })).links.project).toBeNull()
      expect((yield* tasks.get({ id: leaf.id })).links.parent).toBe(child.id)
    })
)

fixture.test(
  "rejects self-parenting, indirect hierarchy cycles, and cycles written through reverse links",
  () =>
    Effect.gen(function* () {
      const db = yield* Database
      const tasks = db.repository(Task)
      const links = yield* Links
      const traversal = (key: string) =>
        modelObjectLinkTraversals(fixture.model, Task).find(
          (item) => item.traversal.key === key
        )!
      const a = yield* tasks.create({ title: "A" })
      const b = yield* tasks.create({ title: "B", links: { parent: a.id } })
      const c = yield* tasks.create({ title: "C", links: { parent: b.id } })
      const journal = yield* EventJournal
      const checkpoint = yield* journal.list({ cursor: "now" })
      for (const parent of [a.id, c.id]) {
        expect(
          yield* tasks.update({ id: a.id, links: { parent } }).pipe(Effect.flip)
        ).toMatchObject({ _tag: "ObjectCheckFailed", rule: "acyclic" })
      }
      expect(
        Exit.isFailure(
          yield* Effect.exit(
            links.link(traversal("subtasks"), { id: c.id, target: a.id })
          )
        )
      ).toBe(true)
      expect((yield* tasks.get({ id: a.id })).links.parent).toBeNull()
      expect(
        (yield* journal.list({ cursor: checkpoint.nextCursor })).items
      ).toHaveLength(0)
      // An atomic rearrangement is valid if its final graph is acyclic.
      yield* db.transaction(() =>
        Effect.gen(function* () {
          yield* tasks.update({ id: a.id, links: { parent: c.id } })
          yield* tasks.update({ id: c.id, links: { parent: null } })
        })
      )
      expect((yield* tasks.get({ id: a.id })).links.parent).toBe(c.id)
    })
)

fixture.test(
  "keeps dependencies independent of nesting and validates association writes in both directions",
  () =>
    Effect.gen(function* () {
      const db = yield* Database
      const tasks = db.repository(Task)
      const links = yield* Links
      const traversal = (key: string) =>
        modelObjectLinkTraversals(fixture.model, Task).find(
          (item) => item.traversal.key === key
        )!
      const a = yield* tasks.create({ title: "Design" })
      const b = yield* tasks.create({
        title: "Procure",
        links: { dependsOn: [a.id] },
      })
      const c = yield* tasks.create({
        title: "Install",
        links: { dependsOn: [b.id] },
      })
      expect(
        yield* tasks
          .update({ id: a.id, links: { dependsOn: [a.id] } })
          .pipe(Effect.flip)
      ).toMatchObject({ _tag: "ObjectCheckFailed" })
      expect(
        yield* tasks
          .update({ id: a.id, links: { dependsOn: [c.id] } })
          .pipe(Effect.flip)
      ).toMatchObject({ _tag: "ObjectCheckFailed" })
      expect(
        Exit.isFailure(
          yield* Effect.exit(
            links.link(traversal("dependents"), { id: c.id, target: a.id })
          )
        )
      ).toBe(true)
      expect((yield* tasks.get({ id: b.id })).links.parent).toBeNull()
      yield* links.unlink(traversal("dependsOn"), { id: c.id, target: b.id })
      yield* links.link(traversal("dependsOn"), { id: a.id, target: c.id })
      expect((yield* tasks.get({ id: c.id })).links.dependents).toMatchObject({
        ids: [a.id],
      })
    })
)

fixture.test(
  "keeps deadlines separate from planned dates and rejects reversed planned ranges",
  () =>
    Effect.gen(function* () {
      const tasks = (yield* Database).repository(Task)
      const task = yield* tasks.create({
        title: "Delivery",
        plannedStartDate: CalendarDate("2026-09-21"),
        plannedFinishDate: CalendarDate("2026-09-25"),
        dueDate: CalendarDate("2026-09-23"),
      })
      expect(
        yield* tasks
          .update({
            id: task.id,
            plannedFinishDate: CalendarDate("2026-09-20"),
          })
          .pipe(Effect.flip)
      ).toMatchObject({ _tag: "ObjectCheckFailed", rule: "plannedDates" })
      expect((yield* tasks.get({ id: task.id })).plannedFinishDate).toBe(
        "2026-09-25"
      )
    })
)

fixture.test(
  "enforces graph constraints for custom SQL writes as well as repositories",
  () =>
    Effect.gen(function* () {
      const db = yield* Database
      const task = yield* db
        .repository(Task)
        .create({ title: "Protect direct writes" })
      expect(
        yield* db
          .transaction(
            () =>
              db.sql`update ${db.table(Task)} set parent_id = ${task.id} where id = ${task.id}`
          )
          .pipe(Effect.flip)
      ).toMatchObject({ _tag: "ObjectCheckFailed", rule: "acyclic" })
      expect(
        (yield* db.repository(Task).get({ id: task.id })).links.parent
      ).toBeNull()
    })
)

for (const isolationLevel of ["read committed", "repeatable read"] as const)
  for (const relation of ["parent", "dependsOn"] as const)
    fixture.test(
      `prevents a ${relation} cycle from concurrent disjoint edges under ${isolationLevel}`,
      () =>
        Effect.gen(function* () {
          const db = yield* Database
          const tasks = db.repository(Task)
          const a = yield* tasks.create({ title: "A" })
          const b = yield* tasks.create({ title: "B" })
          const c = yield* tasks.create({ title: "C" })
          const d = yield* tasks.create({ title: "D" })
          const link = (source: typeof a, target: typeof a) =>
            tasks.update({
              id: source.id,
              links:
                relation === "parent"
                  ? { parent: target.id }
                  : { dependsOn: [target.id] },
            })
          yield* link(a, b)
          yield* link(c, d)
          const first = yield* Deferred.make<void>()
          const second = yield* Deferred.make<void>()
          const results = yield* Effect.all(
            [
              db
                .transaction(
                  () =>
                    Effect.gen(function* () {
                      yield* link(b, c)
                      yield* Deferred.succeed(first, undefined)
                      yield* Deferred.await(second)
                    }),
                  { isolationLevel }
                )
                .pipe(Effect.exit),
              db
                .transaction(
                  () =>
                    Effect.gen(function* () {
                      yield* link(d, a)
                      yield* Deferred.succeed(second, undefined)
                      yield* Deferred.await(first)
                    }),
                  { isolationLevel }
                )
                .pipe(Effect.exit),
            ],
            { concurrency: 2 }
          )
          expect(results.filter(Exit.isSuccess)).toHaveLength(1)
          expect(results.filter(Exit.isFailure)).toHaveLength(1)
        })
    )

fixture.test(
  "standalone task creation and unlinking do not write graph guards",
  () =>
    Effect.gen(function* () {
      const db = yield* Database
      const tasks = db.repository(Task)
      const parent = yield* tasks.create({ title: "Parent" })
      const child = yield* tasks.create({
        title: "Child",
        links: { parent: parent.id },
      })
      const before =
        yield* db.sql`select link_id, revision from link_graph_guards order by link_id`
      const locked = yield* Deferred.make<void>()
      const created = yield* Deferred.make<void>()
      yield* Effect.all(
        [
          db.transaction(() =>
            Effect.gen(function* () {
              yield* db.sql`select link_id from link_graph_guards where link_id = 'taskParent' for update`
              yield* Deferred.succeed(locked, undefined)
              yield* Deferred.await(created)
            })
          ),
          Effect.gen(function* () {
            yield* Deferred.await(locked)
            yield* Effect.forEach(
              Array.from({ length: 50 }, (_, index) => index),
              (index) => tasks.create({ title: `Standalone ${index}` }),
              { concurrency: 5 }
            )
            yield* tasks.update({ id: child.id, links: { parent: null } })
            yield* Deferred.succeed(created, undefined)
          }),
        ],
        { concurrency: 2 }
      ).pipe(Effect.timeout("10 seconds"))
      expect(
        yield* db.sql`select link_id, revision from link_graph_guards order by link_id`
      ).toEqual(before)
      expect((yield* tasks.list({ pageSize: 100 })).items).toHaveLength(52)
    })
)
