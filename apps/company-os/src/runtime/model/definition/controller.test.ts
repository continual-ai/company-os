import { expect, expectTypeOf, it } from "vitest"

import {
  describeModel,
  defineController,
  defineModel,
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

it("declares one target, derives CRUD watches, and keeps scopes precise", () => {
  const object = defineController({
    id: "task-delivery",
    object: Task,
    watch: ["task.updated"],
  })
  const collection = defineController({ id: "task-ranking", collection: Task })
  expectTypeOf(object.scope).toEqualTypeOf<"object">()
  expectTypeOf(object.objectType).toEqualTypeOf<"task">()
  expectTypeOf(collection.scope).toEqualTypeOf<"collection">()
  expect(object.watch).toEqual(["task.created", "task.updated", "task.deleted"])
  expect(() => {
    // @ts-expect-error A target is required.
    defineController({ id: "missing" })
  }).toThrow("exactly one")
  expect(() => {
    // @ts-expect-error Targets are mutually exclusive.
    defineController({ id: "both", object: Task, collection: Task })
  }).toThrow("exactly one")
})

it("projects controller metadata and validates IDs, targets, and watches", () => {
  const controller = defineController({
    id: "task-delivery",
    object: Task,
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
              object: Task,
              watch: ["task.typo"],
            }),
          ],
        }),
      ],
    })
  ).toThrow("unknown event")
})

it("validates portable scheduling and throttle settings", () => {
  const controller = defineController({
    id: "scheduled",
    object: Task,
    schedule: { cron: "*/15 * * * *" },
    minInterval: "5 seconds",
  })
  expect(controller.schedule).toEqual({ cron: "*/15 * * * *", timeZone: "UTC" })
  expect(controller.minInterval).toBe("5 seconds")
  expect(controller.watch).toContain("task.updated")
  expect(() =>
    defineController({
      id: "invalid",
      object: Task,
      schedule: { cron: "not cron" },
    })
  ).toThrow()
  expect(() =>
    defineController({
      id: "invalid",
      object: Task,
      schedule: { cron: "0 * * * *", timeZone: "not/a-zone" },
    })
  ).toThrow()
  expect(() =>
    defineController({ id: "invalid", object: Task, minInterval: "0 seconds" })
  ).toThrow("positive and finite")
  expect(() =>
    defineController({ id: "invalid", object: Task, minInterval: "-5 seconds" })
  ).toThrow("positive and finite")
})
