import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@company/ui/components/card"
import { createFileRoute } from "@tanstack/react-router"

import { companyConfig } from "@/company/config"
import { pageOptions } from "@/route-metadata"

const page = {
  breadcrumb: "Access denied",
  description: `This User does not have access to ${companyConfig.identity.productName}.`,
  title: "Access denied",
}

export const Route = createFileRoute("/access-denied")({
  ...pageOptions(page),
  component: AccessDenied,
})

function AccessDenied() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Access has not been granted</CardTitle>
          <CardDescription>
            Authentication is managed by the deployment gateway. Ask its
            administrator to grant this identity access, then reload the app.
          </CardDescription>
        </CardHeader>
      </Card>
    </main>
  )
}
