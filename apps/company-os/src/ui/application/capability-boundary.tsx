import { Button } from "@company/ui/components/button"
import { Link } from "@tanstack/react-router"
import { LockKeyholeIcon } from "lucide-react"
import { useMemo, type ReactNode } from "react"

import type { CapabilityPermission } from "@/capabilities"

import { useCapabilities } from "./use-capabilities"

export function CapabilityBoundary({
  children,
  description,
  permission,
  title,
}: {
  readonly children: ReactNode
  readonly description: string
  readonly permission: CapabilityPermission
  readonly title: string
}) {
  const checks = useMemo(() => [{ permission }], [permission])
  const capabilities = useCapabilities(checks)

  if (capabilities.loading) {
    return (
      <div className="flex min-h-40 items-center justify-center p-6 text-sm text-muted-foreground">
        Checking access…
      </div>
    )
  }

  if (!capabilities.can({ permission })) {
    return (
      <section className="flex min-h-[60svh] items-center justify-center p-6">
        <div className="w-full max-w-md border bg-muted/10 p-6">
          <LockKeyholeIcon className="size-5 text-muted-foreground" />
          <h1 className="mt-5 text-xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {description}
          </p>
          <Button
            className="mt-6"
            variant="outline"
            nativeButton={false}
            render={<Link to="/" />}
          >
            Back to home
          </Button>
        </div>
      </section>
    )
  }

  return children
}
