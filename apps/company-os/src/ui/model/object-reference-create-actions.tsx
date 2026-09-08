import { Button } from "@company/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@company/ui/components/dropdown-menu"
import { PlusIcon } from "lucide-react"
import { useMemo } from "react"

import { useCapabilities } from "#/ui/application/use-capabilities.ts"
import { objectCapabilityCheck } from "#/ui/model/object-capabilities.ts"
import {
  recordObjectTypes,
  type ModelObject,
} from "#/ui/model/object-client.ts"
import { ObjectIcon } from "#/ui/model/object-record-identity.tsx"

export function creatableReferenceObjects(
  typeId: string
): ReadonlyArray<ModelObject> {
  return recordObjectTypes(typeId).filter(
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
  const entries = useMemo(
    () =>
      creatableReferenceObjects(typeId).flatMap((object) => {
        const check = objectCapabilityCheck(object, "create")
        return check === undefined ? [] : [{ check, object }]
      }),
    [typeId]
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
