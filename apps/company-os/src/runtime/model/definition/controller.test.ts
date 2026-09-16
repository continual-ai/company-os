import { expect, expectTypeOf, it } from "vitest"

import {
  describeModel,
  defineController,
  defineModel,
  defineLink,
  enableModules,
  defineModule,
  defineObject,
  schema,
} from "#/runtime/model/index.ts"

const Task = defineObject({
  id: "task",
  collection: "tasks",
  name: "Task",
  pluralName: "Tasks",
  properties: { title: schema.string() },
  display: { title: "title" },
})

it("declares one target and keeps scopes precise", () => {
  const record = defineController({
    id: "task-delivery",
    record: Task,
  })
  const object = defineController({ id: "task-ranking", object: Task })
  expectTypeOf(record.scope).toEqualTypeOf<"record">()
  expectTypeOf(record.objectType).toEqualTypeOf<"task">()
  expectTypeOf(object.scope).toEqualTypeOf<"object">()
  expect(record.watch).toEqual([])
  expect(() => {
    // @ts-expect-error A target is required.
    defineController({ id: "missing" })
  }).toThrow("exactly one")
  expect(() => {
    // @ts-expect-error Targets are mutually exclusive.
    defineController({ id: "both", record: Task, object: Task })
  }).toThrow("exactly one")
})

it("projects controller metadata and validates IDs, targets, and watches", () => {
  const controller = defineController({
    id: "task-delivery",
    record: Task,
    name: "Deliver tasks",
    description: "Keep delivery progressing.",
  })
  const module = defineModule({
    id: "work",
    name: "Work",
    objects: [Task],
    controllers: [controller],
  })
  const model = defineModel({ name: "Test", modules: [module] })
  expect(describeModel(model).controllers).toEqual([controller])
  expect(() =>
    defineModel({
      name: "Test",
      modules: [
        defineModule({ id: "work", name: "Work", controllers: [controller] }),
      ],
    })
  ).toThrow()
  expect(() =>
    defineModel({
      name: "Test",
      modules: [
        defineModule({
          id: "work",
          name: "Work",
          objects: [Task],
          controllers: [controller, controller],
        }),
      ],
    })
  ).toThrow("Duplicate controller")
  expect(() =>
    defineModel({
      name: "Test",
      modules: [
        defineModule({
          id: "work",
          name: "Work",
          objects: [Task],
          controllers: [
            defineController({
              id: "typo",
              record: Task,
              watch: ["task.typo"],
            }),
          ],
        }),
      ],
    })
  ).toThrow("exactly one relationship")
})

it("validates portable scheduling and throttle settings", () => {
  const controller = defineController({
    id: "scheduled",
    record: Task,
    schedule: { cron: "*/15 * * * *" },
    minInterval: "5 seconds",
  })
  expect(controller.schedule).toEqual({ cron: "*/15 * * * *", timeZone: "UTC" })
  expect(controller.minInterval).toBe("5 seconds")
  expect(controller.watch).toEqual([])
  expect(() =>
    defineController({
      id: "invalid",
      record: Task,
      schedule: { cron: "not cron" },
    })
  ).toThrow()
  expect(() =>
    defineController({
      id: "invalid",
      record: Task,
      schedule: { cron: "0 * * * *", timeZone: "not/a-zone" },
    })
  ).toThrow()
  expect(() =>
    defineController({ id: "invalid", record: Task, minInterval: "0 seconds" })
  ).toThrow("positive and finite")
  expect(() =>
    defineController({ id: "invalid", record: Task, minInterval: "-5 seconds" })
  ).toThrow("positive and finite")
})

it("validates complete relationship paths and retains their owning module dependencies", () => {
  const Tree = defineLink({
    id: "taskTree",
    from: { object: Task, key: "children" },
    to: { object: Task, key: "parent", max: 1 },
  })
  const records = defineModule({
    id: "recordsModule",
    name: "Records",
    objects: [Task],
  })
  const relationships = defineModule({
    id: "relationships",
    name: "Relationships",
    links: [Tree],
  })
  const controller = defineController({
    id: "tree",
    record: Task,
    watch: ["children.parent.children", "children"],
  })
  const workers = defineModule({
    id: "workers",
    name: "Workers",
    controllers: [controller],
  })
  const model = defineModel({
    name: "Tree",
    modules: [records, relationships, workers],
  })
  expect(controller.watch).toEqual(["children.parent.children", "children"])
  expect(() => enableModules(model, ["recordsModule", "workers"])).toThrow(
    "relationships"
  )
  for (const path of [
    "title",
    "children.title",
    "children.updated",
    "children.missing",
  ]) {
    expect(() =>
      defineModel({
        name: "Invalid",
        modules: [
          records,
          relationships,
          defineModule({
            id: "workers",
            name: "Workers",
            controllers: [
              defineController({ id: "bad", record: Task, watch: [path] }),
            ],
          }),
        ],
      })
    ).toThrow("exactly one relationship")
  }
  for (const path of ["", "children.", "children..parent", "children.*"]) {
    expect(() =>
      defineController({ id: "bad", record: Task, watch: [path] })
    ).toThrow("relationship paths")
  }
})
