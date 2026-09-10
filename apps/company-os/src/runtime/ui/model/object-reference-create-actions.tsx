import { Button } from "@company/ui/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@company/ui/dropdown-menu"
import { PlusIcon } from "lucide-react"

import {
  recordObjectTypes,
  type ModelObject,
} from "#/runtime/ui/model/object-client.ts"
import { ObjectIcon } from "#/runtime/ui/model/object-record-identity.tsx"
import {
  type ModelUiRuntime,
  useModelRuntime,
} from "#/runtime/ui/model/runtime-context.tsx"

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

  const available = creatableReferenceObjects(runtime, typeId)
  if (available.length === 0) return null

  return (
    <div className="grid border-t p-1">
      {available.length === 1 ? (
        <Button
          type="button"
          variant="ghost"
          className="justify-start"
          onClick={() => onCreate(available[0]!)}
        >
          <PlusIcon />
          Create new {available[0]!.name.toLowerCase()}
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
            {available.map((object) => (
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
