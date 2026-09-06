import { Button } from "@company/ui/components/button"
import { Link } from "@tanstack/react-router"
export function GroupToolbar() {
  return (
    <Button
      variant="outline"
      nativeButton={false}
      render={<Link to="/settings/group-memberships" />}
    >
      Memberships
    </Button>
  )
}
