import { Button } from "@company/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@company/ui/card"
import { createFileRoute } from "@tanstack/react-router"
import { ArrowLeftIcon } from "lucide-react"

import { appConfig } from "#/app/customization/config.ts"
import { pageOptions } from "#/app/ui/route-metadata.ts"

const page = {
  breadcrumb: "Sign in",
  description: `Sign in through your organization to open ${appConfig.identity.name}.`,
  title: "Sign in",
}

export const Route = createFileRoute("/sign-in")({
  ...pageOptions(page),
  component: SignIn,
})

function SignIn() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in to {appConfig.identity.name}</CardTitle>
          <CardDescription>
            Open your organization’s sign-in link, then return to this app.
            Contact your administrator if you need the link.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            nativeButton={false}
            render={<a href="/" aria-label="Try again" />}
          >
            <ArrowLeftIcon data-icon="inline-start" />
            Try again
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
