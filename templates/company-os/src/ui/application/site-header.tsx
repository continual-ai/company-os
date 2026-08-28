import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@company/ui/components/breadcrumb"
import { SidebarTrigger } from "@company/ui/components/sidebar"
import { Link, useMatches } from "@tanstack/react-router"
import { Fragment } from "react"

import { pageMetadataForMatch } from "@/route-metadata"
import { usePageChrome } from "@/ui/application/page-chrome"

export function SiteHeader() {
  const pageChrome = usePageChrome()
  const breadcrumbs = useMatches({
    select: (matches) =>
      matches.flatMap((match) => {
        const page = pageMetadataForMatch(match)

        return page ? [{ id: match.id, to: match.pathname, ...page }] : []
      }),
  })
  return (
    <header className="flex h-(--header-height) shrink-0 items-center border-b bg-background">
      <div className="flex w-full items-center gap-3 px-5">
        <SidebarTrigger className="-ml-1.5" />
        <Breadcrumb className="min-w-0">
          <BreadcrumbList className="flex-nowrap">
            {breadcrumbs.map((breadcrumb, index) => {
              const isCurrent = index === breadcrumbs.length - 1
              const label =
                isCurrent && pageChrome.breadcrumb !== undefined
                  ? pageChrome.breadcrumb
                  : breadcrumb.breadcrumb

              return (
                <Fragment key={breadcrumb.id}>
                  {index > 0 ? <BreadcrumbSeparator /> : null}
                  <BreadcrumbItem>
                    {isCurrent ? (
                      <BreadcrumbPage>{label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink render={<Link to={breadcrumb.to} />}>
                        {label}
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </Fragment>
              )
            })}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </header>
  )
}
