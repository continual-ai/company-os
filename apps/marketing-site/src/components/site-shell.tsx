import { modelMetadata } from "@company/model/metadata"
import { buttonVariants } from "@company/ui/components/button"
import { cn } from "@company/ui/lib/utils"
import { Link } from "@tanstack/react-router"

import { clientPortalUrl, companyOsUrl } from "@/lib/app-urls"

export function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-svh">
      <header className="border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/" className="font-semibold tracking-tight">
            {modelMetadata.name}
          </Link>
          <nav className="flex items-center gap-2" aria-label="Primary">
            <a
              href={clientPortalUrl}
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            >
              Client Portal
            </a>
            <a
              href={companyOsUrl}
              className={cn(buttonVariants({ size: "sm" }))}
            >
              Company OS
            </a>
          </nav>
        </div>
      </header>
      {children}
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-8 text-sm text-muted-foreground sm:flex-row sm:justify-between">
          <p>© 2026 {modelMetadata.name}.</p>
          <p>Customers, projects, and work in one connected system.</p>
        </div>
      </footer>
    </div>
  )
}
