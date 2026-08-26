import { Model } from "@company/model"
import { Button } from "@company/ui/components/button"
import { Link, createFileRoute } from "@tanstack/react-router"

import { pageOptions } from "@/route-metadata"
import { ObjectCollection } from "@/ui/model/object-collection"

export const Route = createFileRoute("/_app/settings/(access)/groups")({
  ...pageOptions({
    breadcrumb: "Groups",
    description: "Manage reusable collections of identities.",
    title: "Groups",
  }),
  component: GroupsPage,
})

function GroupsPage() {
  return (
    <ObjectCollection
      object={Model.objects.group}
      renderCollectionActions={() => (
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link to="/settings/group-memberships" />}
        >
          Memberships
        </Button>
      )}
    />
  )
}
