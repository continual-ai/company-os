import { modelMetadata } from "@company/model/metadata"
import { Button } from "@company/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@company/ui/components/card"
import { createFileRoute } from "@tanstack/react-router"

import { pageOptions } from "@/route-metadata"
import { useSignOut } from "@/sign-out"

const page = {
  breadcrumb: "Access denied",
  description: `This User does not have access to ${modelMetadata.name}.`,
  title: "Access denied",
}

export const Route = createFileRoute("/access-denied")({
  ...pageOptions(page),
  component: AccessDenied,
})

function AccessDenied() {
  const { error, pending, signOut } = useSignOut()

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Access has not been granted</CardTitle>
          <CardDescription>
            Ask an administrator for an invitation. On an unclaimed
            installation, the first verified User to sign in becomes
            administrator unless a bootstrap email is configured.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => void signOut()}
          >
            {pending ? "Signing out…" : "Sign in with another account"}
          </Button>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </main>
  )
}
