import { Button } from "@company/ui/button"
import { useInfiniteQuery } from "@tanstack/react-query"

import { PlatformModel } from "#/runtime/platform/model/index.ts"
import { ControllerDiagnostics } from "#/runtime/platform/ui/controller-diagnostics.tsx"
import { useModelRuntime } from "#/runtime/ui/model/runtime-context.tsx"
import { useClient } from "#/runtime/ui/model/use-client.ts"

export function ObjectControllers({
  objectType,
  recordId,
}: {
  readonly objectType: string
  readonly recordId?: string
}) {
  const client = useClient(PlatformModel)
  const { model } = useModelRuntime()
  const definitions = Object.values(model.modules)
    .flatMap((module) => module.controllers)
    .filter(
      (definition) =>
        definition.objectType === objectType &&
        (!recordId || definition.scope === "object")
    )
  const query = useInfiniteQuery(
    client.controller.list.infiniteQueryOptions({
      filter: {
        field: "definitionId",
        operator: "in",
        value: definitions.map((definition) => definition.id),
      },
      pageSize: 50,
    })
  )
  if (query.isPending)
    return (
      <p className="p-page-gutter text-sm text-muted-foreground">
        Loading controllers…
      </p>
    )
  if (query.isError)
    return (
      <p role="alert" className="p-page-gutter text-sm text-destructive">
        {query.error.message}
      </p>
    )
  const controllers = query.data.pages.flatMap((page) => page.items)
  return (
    <div className="space-y-4 p-page-gutter">
      <h2 className="text-base font-semibold">Controllers</h2>
      {controllers.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No controllers are configured.
        </p>
      )}
      {controllers.map((controller) => (
        <ControllerDiagnostics
          key={controller.id}
          controller={controller}
          targetKey={recordId}
        />
      ))}
      {query.hasNextPage && (
        <Button
          variant="outline"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          Load more
        </Button>
      )}
    </div>
  )
}
