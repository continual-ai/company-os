import { PlusIcon } from "lucide-react"
import { useMemo } from "react"

import { Button } from "#/runtime/ui/components/button.tsx"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "#/runtime/ui/components/dropdown-menu.tsx"
import { objectCapabilityCheck } from "#/runtime/ui/model/object-capabilities.ts"
import {
  recordObjectTypes,
  type ModelObject,
} from "#/runtime/ui/model/object-client.ts"
import { ObjectIcon } from "#/runtime/ui/model/object-record-identity.tsx"
import {
  type ModelUiRuntime,
  useModelRuntime,
} from "#/runtime/ui/model/runtime-context.tsx"
import { useCapabilities } from "#/runtime/ui/model/use-capabilities.ts"

export function creatableReferenceObjects(
  runtime: ModelUiRuntime,
  typeId: string
): ReadonlyArray<ModelObject> {
  return recordObjectTypes(runtime, typeId).filter(
    (object) => "create" in object.actions
  )
}

export function ObjectReferenceCreateActions({
  onCreate,
  typeId,
}: {
  readonly onCreate: (object: ModelObject) => void
  readonly typeId: string
}) {
  const runtime = useModelRuntime()

  const entries = useMemo(
    () =>
      creatableReferenceObjects(runtime, typeId).flatMap((object) => {
        const check = objectCapabilityCheck(runtime, object, "create")
        return check === undefined ? [] : [{ check, object }]
      }),
    [runtime, typeId]
  )
  const checks = useMemo(() => entries.map(({ check }) => check), [entries])
  const capabilities = useCapabilities(checks)
  const available = entries.filter(({ check }) => capabilities.can(check))

  if (capabilities.loading || available.length === 0) return null

  return (
    <div className="grid border-t p-1">
      {available.length === 1 ? (
        <Button
          type="button"
          variant="ghost"
          className="justify-start"
          onClick={() => onCreate(available[0]!.object)}
        >
          <PlusIcon />
          Create new {available[0]!.object.name.toLowerCase()}
        </Button>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                className="w-full justify-start"
              />
            }
          >
            <PlusIcon /> Create new record
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-64 w-64">
            {available.map(({ object }) => (
              <DropdownMenuItem
                key={object.id}
                onClick={() => onCreate(object)}
              >
                <ObjectIcon object={object} />
                {object.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
