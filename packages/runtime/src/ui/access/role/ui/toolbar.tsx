import { Link } from "@tanstack/react-router"

import { Button } from "#/ui/components/button.tsx"
export function RoleToolbar() {
  return (
    <Button
      variant="outline"
      nativeButton={false}
      render={<Link to="/settings/role-assignments" />}
    >
      Assignments
    </Button>
  )
}
