import { CodeBlock } from "@company/ui/code-block"
import { useScrollSpy } from "@company/ui/hooks/use-scroll-spy"
import { useHydrated, useLocation } from "@tanstack/react-router"
import { useEffect, useRef, useState, type ComponentType } from "react"

import { contentSections } from "#/app/ui/developer/design-system/content.tsx"
import { controlSections } from "#/app/ui/developer/design-system/controls.tsx"
import { Foundations } from "#/app/ui/developer/design-system/foundations.tsx"
import { navigationSections } from "#/app/ui/developer/design-system/navigation.tsx"
import { overlaySections } from "#/app/ui/developer/design-system/overlays.tsx"
import { Patterns } from "#/app/ui/developer/design-system/patterns.tsx"
import { DeveloperBrowserSearch } from "#/app/ui/developer/developer-browser.tsx"
import {
  DeveloperLayout,
  DeveloperNavigationGroup,
  DeveloperNavigationItem,
} from "#/app/ui/developer/developer-layout.tsx"

interface GallerySection {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly group: string
  readonly usage?: string
  readonly component: ComponentType
}

function RecordPatterns() {
  return <Patterns section="records" />
}
function TablePatterns() {
  return <Patterns section="table" />
}
function LayoutPatterns() {
  return <Patterns section="layouts" />
}
function FormPatterns() {
  return <Patterns section="forms" />
}

const sections: ReadonlyArray<GallerySection> = [
  {
    id: "foundations",
    title: "Foundations",
    group: "Start here",
    description:
      "The shared palette, typography, shape, and density. Use semantic tokens so interfaces stay consistent across themes.",
    component: Foundations,
  },
  {
    id: "records",
    title: "Record presentation",
    group: "Application patterns",
    description:
      "Identities, property values, choices, and status progression composed from the model.",
    component: RecordPatterns,
  },
  {
    id: "object-table",
    title: "Object table",
    group: "Application patterns",
    description:
      "Editable records with filtering, sorting, selection, and failure states.",
    component: TablePatterns,
  },
  {
    id: "layouts",
    title: "Collection layouts",
    group: "Application patterns",
    description: "The same records in a board, calendar, or timeline.",
    component: LayoutPatterns,
  },
  {
    id: "forms",
    title: "Record forms",
    group: "Application patterns",
    description: "Generated editors with validation and draft behavior.",
    component: FormPatterns,
  },
  ...[
    ...controlSections,
    ...contentSections,
    ...navigationSections,
    ...overlaySections,
  ]
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((section) => ({ ...section, group: "Components" })),
]

const sectionIds = sections.map((section) => section.id)

export function DesignSystemGallery() {
  const containerRef = useRef<HTMLDivElement>(null)
  const activeId = useScrollSpy({ containerRef, sectionIds })
  const [search, setSearch] = useState("")
  const hash = useLocation({ select: (location) => location.hash })
  const hydrated = useHydrated()
  useEffect(() => {
    if (!hydrated || !hash) return undefined
    const frame = requestAnimationFrame(() => {
      document.getElementById(hash)?.scrollIntoView()
    })
    return () => cancelAnimationFrame(frame)
  }, [hydrated, hash])
  const matches = sections.filter((item) =>
    `${item.title} ${item.description} ${item.id}`
      .toLowerCase()
      .includes(search.toLowerCase().trim())
  )
  return (
    <DeveloperLayout
      sidebarLabel="Design system"
      sidebar={
        <>
          <div className="sticky top-0 z-10 bg-background p-3">
            <DeveloperBrowserSearch
              label="Find a component"
              placeholder="Find a component…"
              value={search}
              onChange={setSearch}
            />
          </div>
          {["Start here", "Application patterns", "Components"].map((group) => {
            const items = matches.filter((item) => item.group === group)
            return items.length > 0 ? (
              <DeveloperNavigationGroup
                key={group}
                title={group}
                count={items.length}
              >
                {items.map((item) => (
                  <DeveloperNavigationItem
                    key={item.id}
                    active={activeId === item.id}
                    current="location"
                    render={<a href={`#${item.id}`} aria-label={item.title} />}
                  >
                    {item.title}
                  </DeveloperNavigationItem>
                ))}
              </DeveloperNavigationGroup>
            ) : null
          })}
          {matches.length === 0 && (
            <output className="block p-4 text-sm text-muted-foreground">
              No matching components.
            </output>
          )}
        </>
      }
    >
      <div
        ref={containerRef}
        className="mx-auto w-full max-w-5xl px-page-gutter"
      >
        <header className="py-8 lg:py-10">
          <h1 className="text-2xl font-semibold tracking-tight">
            Design system
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Foundations, application patterns, and the components we build with.
            Explore live examples and copy the usage into your own interface.
          </p>
        </header>
        {sections.map(
          ({ id, title, description, group, usage, component: Component }) => (
            <section
              key={id}
              id={id}
              aria-labelledby={`${id}-heading`}
              className="scroll-mt-6 space-y-6 border-t py-8 lg:py-10"
            >
              <header>
                <p className="text-xs font-medium text-muted-foreground">
                  {group}
                </p>
                <h2
                  id={`${id}-heading`}
                  className="mt-2 text-xl font-semibold tracking-tight"
                >
                  <a
                    href={`#${id}`}
                    className="rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    {title}
                  </a>
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  {description}
                </p>
              </header>
              <div className="space-y-8">
                <Component />
              </div>
              {usage && (
                <details className="group">
                  <summary className="w-fit cursor-pointer rounded-sm text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring">
                    Usage
                  </summary>
                  <CodeBlock
                    code={usage}
                    language="tsx"
                    label={`${title} usage`}
                    className="mt-3"
                  />
                </details>
              )}
            </section>
          )
        )}
      </div>
    </DeveloperLayout>
  )
}
