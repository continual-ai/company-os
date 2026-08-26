import { Model } from "@company/model"
import { Button } from "@company/ui/components/button"
import { Link, createFileRoute } from "@tanstack/react-router"

import { pageOptions } from "@/route-metadata"
import { ObjectCollection } from "@/ui/model/object-collection"

export const Route = createFileRoute("/_app/settings/(access)/roles")({
  ...pageOptions({
    breadcrumb: "Roles",
    description: "Review permission sets.",
    title: "Roles",
  }),
  component: RolesPage,
})

function RolesPage() {
  return (
    <ObjectCollection
      object={Model.objects.role}
      renderCollectionActions={() => (
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link to="/settings/role-assignments" />}
        >
          Assignments
        </Button>
      )}
    />
  )
}
