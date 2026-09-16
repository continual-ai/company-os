import { Badge } from "@company/ui/badge"

import { DeveloperBrowserEmpty } from "#/app/ui/developer/developer-browser.tsx"
import type { Controller } from "#/runtime/model/index.ts"
import { controllerAlias } from "#/runtime/platform/model/controller.ts"

export function ModelControllers({
  controllers,
}: {
  readonly controllers: ReadonlyArray<Controller>
}) {
  if (controllers.length === 0)
    return (
      <DeveloperBrowserEmpty>
        No controllers target this object or its collection.
      </DeveloperBrowserEmpty>
    )

  return (
    <div className="space-y-3">
      {controllers.map((controller) => (
        <div key={controller.id} className="rounded-lg border p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{controller.name}</p>
              <code className="mt-1 block text-[10px] text-muted-foreground">
                {controller.id}
              </code>
            </div>
            <Badge variant="outline">{controller.scope}</Badge>
          </div>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            {controller.description}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {controller.scope === "record"
              ? "One reconciliation key per record."
              : "One reconciliation key for the Object."}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Rescan:{" "}
            {controller.schedule
              ? `${controller.schedule.cron} (${controller.schedule.timeZone})`
              : "No schedule"}
            {" · "}Minimum interval per key: {controller.minInterval ?? "None"}
          </p>
          <div className="mt-4">
            <p className="text-xs font-medium">Watched relationships</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Target record changes are watched automatically.
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {controller.watch.map((type) => (
                <li key={type}>
                  <code className="rounded bg-muted px-2 py-1 text-[10px]">
                    {type}
                  </code>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-4 flex gap-4 text-xs">
            <a
              className="underline underline-offset-4"
              href={`/objects/controller/${controllerAlias(controller.id)}`}
            >
              View execution state
            </a>
            <a
              className="underline underline-offset-4"
              href="/developer/api?operation=controller.status"
            >
              API reference
            </a>
          </div>
        </div>
      ))}
    </div>
  )
}
