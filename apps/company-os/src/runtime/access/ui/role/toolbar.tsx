import { Link } from "@tanstack/react-router"

import { RoleAssignment } from "#/runtime/access/model/index.ts"
import { Button } from "#/runtime/ui/components/button.tsx"
import { objectHref } from "#/runtime/ui/model/object-routing.ts"
import { useModelRuntime } from "#/runtime/ui/model/runtime-context.tsx"

export function RoleToolbar() {
  const runtime = useModelRuntime()
  return (
    <Button
      variant="outline"
      nativeButton={false}
      render={<Link to={objectHref(runtime, RoleAssignment)} />}
    >
      Assignments
    </Button>
  )
}
