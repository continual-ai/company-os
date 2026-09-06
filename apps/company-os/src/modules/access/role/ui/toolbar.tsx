import { Button } from "@company/ui/components/button"
import { Link } from "@tanstack/react-router"
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
