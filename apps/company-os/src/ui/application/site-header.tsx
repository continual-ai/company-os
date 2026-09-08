import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@company/runtime/ui/breadcrumb"
import { Button } from "@company/runtime/ui/button"
import { usePageChrome } from "@company/runtime/ui/model/page-chrome"
import { SidebarTrigger } from "@company/runtime/ui/sidebar"
import {
  Link,
  useMatches,
  useCanGoBack,
  useRouter,
} from "@tanstack/react-router"
import { ArrowLeftIcon } from "lucide-react"
import { Fragment } from "react"

import { pageMetadataForMatch } from "#/route-metadata.ts"

export function SiteHeader() {
  const pageChrome = usePageChrome()
  const router = useRouter()
  const canGoBack = useCanGoBack()
  const breadcrumbs = useMatches({
    select: (matches) =>
      matches.flatMap((match) => {
        const page = pageMetadataForMatch(match)

        return page ? [{ id: match.id, to: match.pathname, ...page }] : []
      }),
  })
  const items = pageChrome.collectionHref
    ? [
        {
          id: "collection",
          to: pageChrome.collectionHref,
          breadcrumb: pageChrome.collectionLabel,
        },
        { id: "record", to: "", breadcrumb: pageChrome.breadcrumb },
      ]
    : breadcrumbs
  return (
    <header className="flex h-(--header-height) shrink-0 items-center border-b bg-background">
      <div className="flex w-full items-center gap-3 px-5">
        <SidebarTrigger className="-ml-1.5" />
        {pageChrome.collectionHref && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={
              canGoBack ? "Back" : `Back to ${pageChrome.collectionLabel}`
            }
            onClick={() => {
              if (canGoBack) router.history.back()
              else void router.navigate({ to: pageChrome.collectionHref! })
            }}
          >
            <ArrowLeftIcon />
          </Button>
        )}
        <Breadcrumb className="min-w-0">
          <BreadcrumbList className="flex-nowrap">
            {items.map((breadcrumb, index) => {
              const isCurrent = index === items.length - 1
              const label =
                isCurrent && pageChrome.breadcrumb !== undefined
                  ? pageChrome.breadcrumb
                  : breadcrumb.breadcrumb

              return (
                <Fragment key={breadcrumb.id}>
                  {index > 0 ? <BreadcrumbSeparator /> : null}
                  <BreadcrumbItem className="min-w-0">
                    {isCurrent ? (
                      <BreadcrumbPage className="truncate">
                        {label}
                      </BreadcrumbPage>
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
