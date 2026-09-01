import { Button } from "@company/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@company/ui/components/card"
import { createFileRoute } from "@tanstack/react-router"
import { ArrowLeftIcon } from "lucide-react"

import { applicationConfig } from "@/customization/config"
import { pageOptions } from "@/route-metadata"

const page = {
  breadcrumb: "Sign in",
  description: `Open ${applicationConfig.identity.productName} through Continual to sign in.`,
  title: "Sign in with Continual",
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
          <CardTitle>Open this App through Continual</CardTitle>
          <CardDescription>
            Continual authenticates you before forwarding requests to this App.
            This address did not include a Continual App identity.
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
