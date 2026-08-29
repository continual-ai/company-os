import { Button } from "@company/ui/components/button"
import { PlusIcon } from "lucide-react"
import { useMemo } from "react"

import { useCapabilities } from "@/ui/application/use-capabilities"

import { objectCapabilityCheck } from "./object-capabilities"
import { recordObjectTypes, type ModelObject } from "./object-client"

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
      {available.map(({ object }) => (
        <Button
          key={object.id}
          type="button"
          variant="ghost"
          className="justify-start"
          onClick={() => onCreate(object)}
        >
          <PlusIcon />
          Create new {object.name.toLowerCase()}
        </Button>
      ))}
    </div>
  )
}
