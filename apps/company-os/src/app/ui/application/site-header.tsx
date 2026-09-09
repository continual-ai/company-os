import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@company/ui/breadcrumb"
import { Button } from "@company/ui/button"
import { useKeyboardShortcuts } from "@company/ui/keyboard-shortcuts"
import { SidebarTrigger, useSidebar } from "@company/ui/sidebar"
import {
  Link,
  useMatches,
  useCanGoBack,
  useRouter,
} from "@tanstack/react-router"
import {
  ArrowLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  LoaderCircleIcon,
} from "lucide-react"
import { Fragment, useRef, useState } from "react"

import { pageMetadataForMatch } from "#/app/ui/route-metadata.ts"
import { usePageChrome } from "#/runtime/ui/model/page-chrome.tsx"
import type { RecordNavigation } from "#/runtime/ui/model/record-navigation.tsx"

export function SiteHeader() {
  const { open, isMobile } = useSidebar()
  const pageChrome = usePageChrome()
  const router = useRouter()
  const canGoBack = useCanGoBack()
  useKeyboardShortcuts(
    pageChrome.collectionHref
      ? [
          {
            id: "back-to-collection",
            key: "Escape",
            label: "Esc",
            description: `Back to ${pageChrome.collectionLabel}`,
            group: "Records",
            run: () => {
              void router.navigate({
                to: pageChrome.collectionHref!,
                replace: true,
              })
            },
          },
        ]
      : []
  )
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
      ]
    : breadcrumbs
  return (
    <header className="flex h-(--header-height) shrink-0 items-center border-b bg-background">
      <div className="flex w-full items-center gap-3 px-5">
        {(isMobile || !open) && (
          <SidebarTrigger className="-ml-1.5" aria-label="Open sidebar" />
        )}
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
              const isCurrent =
                !pageChrome.collectionHref && index === items.length - 1
              const label = breadcrumb.breadcrumb

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
        {pageChrome.recordNavigation && (
          <RecordPager navigation={pageChrome.recordNavigation} />
        )}
      </div>
    </header>
  )
}

function RecordPager({ navigation }: { navigation: RecordNavigation }) {
  const router = useRouter()
  const pending = useRef(false)
  const [navigating, setNavigating] = useState(false)
  const previousDisabled =
    !navigation.previousHref || navigation.loading || navigating
  const nextDisabled =
    navigation.loading ||
    navigating ||
    (!navigation.nextHref && !navigation.hasNextPage)
  const move = async (direction: "previous" | "next") => {
    if (
      pending.current ||
      (direction === "previous" ? previousDisabled : nextDisabled)
    )
      return
    pending.current = true
    setNavigating(true)
    try {
      const location = router.state.location.href
      const href =
        direction === "previous"
          ? navigation.previousHref
          : (navigation.nextHref ?? (await navigation.loadNext()))
      if (href && router.state.location.href === location)
        await router.navigate({ to: href, replace: true })
    } finally {
      pending.current = false
      setNavigating(false)
    }
  }
  useKeyboardShortcuts([
    {
      id: "previous-record",
      key: "ArrowLeft",
      label: "←",
      description: "Previous record",
      group: "Records",
      enabled: !previousDisabled,
      run: () => {
        void move("previous")
      },
    },
    {
      id: "next-record",
      key: "ArrowRight",
      label: "→",
      description: "Next record",
      group: "Records",
      enabled: !nextDisabled,
      run: () => {
        void move("next")
      },
    },
  ])
  return (
    <nav
      className="ml-auto flex items-center gap-1"
      aria-label="Record navigation"
    >
      {navigation.error && (
        <span role="alert" className="mr-2 text-xs text-destructive">
          {navigation.error}
        </span>
      )}
      <span
        className="mr-2 whitespace-nowrap text-xs text-muted-foreground tabular-nums"
        aria-live="polite"
      >
        {navigation.position.toLocaleString()} of{" "}
        {navigation.total.toLocaleString()}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Previous record"
        aria-keyshortcuts="ArrowLeft"
        title="Previous record (←)"
        disabled={previousDisabled}
        onClick={() => {
          void move("previous")
        }}
      >
        <ChevronLeftIcon />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Next record"
        aria-busy={navigation.loading}
        aria-keyshortcuts="ArrowRight"
        title="Next record (→)"
        disabled={nextDisabled}
        onClick={() => {
          void move("next")
        }}
      >
        {navigation.loading ? (
          <LoaderCircleIcon className="animate-spin" />
        ) : (
          <ChevronRightIcon />
        )}
      </Button>
    </nav>
  )
}
