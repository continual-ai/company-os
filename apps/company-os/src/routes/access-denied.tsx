import { Button } from "@company/ui/components/button"
import {
  Card,
  CardContent,
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
            This identity is verified but does not have access to this
            application. Ask an administrator to grant access, or try another
            account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            nativeButton={false}
            render={<a href="/sign-out" aria-label="Try another account" />}
          >
            Try another account
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
