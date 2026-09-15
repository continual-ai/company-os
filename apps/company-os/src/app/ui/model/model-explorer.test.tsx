import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterContextProvider,
} from "@tanstack/react-router"
import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vitest"

import { Model } from "#/app.model.ts"
import { ModelExplorer } from "#/app/ui/developer/model-explorer.tsx"
import {
  defineController,
  defineModel,
  defineModule,
  defineObject,
  schema,
} from "#/runtime/model/index.ts"

it("shows link traversals and inherited interface relationships on concrete objects", () => {
  const router = createRouter({
    routeTree: createRootRoute(),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  })
  const html = renderToStaticMarkup(
    <RouterContextProvider router={router}>
      <ModelExplorer model={Model} selectedItem="object:contact" />
    </RouterContextProvider>
  )
  const detail = html.slice(html.indexOf("<article"))
  expect(detail).toContain(">Tickets</p>")
  expect(detail).toContain(">Notes</p>")
  expect(detail).toContain("link")
})

it("shows object and collection controllers from any module on their target's model page", () => {
  const Task = defineObject({
    id: "task",
    collection: "tasks",
    name: "Task",
    pluralName: "Tasks",
    properties: { title: schema.string() },
    display: { title: "title" },
  })
  const Signal = defineObject({
    id: "signal",
    collection: "signals",
    name: "Signal",
    pluralName: "Signals",
    properties: { title: schema.string() },
    display: { title: "title" },
  })
  const model = defineModel({
    name: "Test",
    modules: [
      defineModule({ id: "work", name: "Work", objects: [Task, Signal] }),
      defineModule({
        id: "automation",
        name: "Automation",
        controllers: [
          defineController({
            id: "deliver",
            name: "Deliver tasks",
            object: Task,
          }),
          defineController({
            id: "prioritize",
            name: "Prioritize tasks",
            collection: Task,
          }),
          defineController({
            id: "triage",
            name: "Triage signals",
            object: Signal,
          }),
        ],
      }),
    ],
  })
  const router = createRouter({
    routeTree: createRootRoute(),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  })
  const markup = renderToStaticMarkup(
    <RouterContextProvider router={router}>
      <ModelExplorer model={model} selectedItem="object:task" />
    </RouterContextProvider>
  )
  expect(markup).toContain('id="controllers"')
  expect(markup).toContain("Deliver tasks")
  expect(markup).toContain("Prioritize tasks")
  expect(markup).not.toContain("Triage signals")
  expect(markup).toContain("task.created")
  expect(markup).toContain(
    'href="/objects/controller/system:controller:deliver"'
  )
  expect(markup).toContain('href="/developer/api?operation=controller.status"')
})
