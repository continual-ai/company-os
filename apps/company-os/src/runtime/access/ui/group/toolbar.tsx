import { Link } from "@tanstack/react-router"

import { Button } from "#/runtime/ui/components/button.tsx"
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
