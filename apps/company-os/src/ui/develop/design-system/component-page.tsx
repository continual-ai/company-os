import { ComponentExample } from "@/ui/develop/design-system/component-example"
import { getComponentExample } from "@/ui/develop/design-system/component-examples"
import type { ComponentSlug } from "@/ui/develop/design-system/component-metadata"
import { getComponent } from "@/ui/develop/design-system/component-metadata"

export function ComponentPage({ slug }: { slug: ComponentSlug }) {
  const component = getComponent(slug)
  const example = getComponentExample(slug)

  if (!component) return null

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10 lg:px-12 lg:py-14">
      <header className="max-w-2xl">
        <p className="text-xs font-medium text-muted-foreground">
          {component.group}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          {component.name}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {component.description}
        </p>
      </header>

      <ComponentExample code={example.code}>{example.preview}</ComponentExample>

      <section className="mt-12 grid gap-5 border-t pt-6 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <p className="text-xs font-medium text-muted-foreground">Usage</p>
        <div className="max-w-2xl">
          <p className="text-sm leading-6">{example.usage}</p>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            Import through{" "}
            <code className="bg-muted px-1.5 py-0.5">
              @company/ui/components/{component.slug}
            </code>
            . Business meaning and workflow composition remain with the owning
            application.
          </p>
        </div>
      </section>
    </div>
  )
}
