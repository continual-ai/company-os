import { createFileRoute } from "@tanstack/react-router"

import { pageOptions } from "@/route-metadata"

const collections = [
  {
    title: "Company",
    description: "Purpose, strategy, structure, and the context people share.",
  },
  {
    title: "How we work",
    description: "Roles, policies, operating rhythms, and decision guidance.",
  },
  {
    title: "Playbooks",
    description: "Practical guidance for recurring work across the business.",
  },
] as const

const page = {
  breadcrumb: "Learn",
  description:
    "Explore the governed knowledge behind how Acme operates, from company context to playbooks and ways of working.",
  title: "Learn",
}

export const Route = createFileRoute("/_app/learn")({
  ...pageOptions(page),
  component: LearnOverview,
})

function LearnOverview() {
  return (
    <div className="mx-auto w-full max-w-[90rem] px-5 py-10 lg:px-8 lg:py-14">
      <section className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight">
          The knowledge behind how Acme operates.
        </h1>
        <p className="mt-3 max-w-2xl leading-7 text-muted-foreground">
          Learn can grow from a company handbook into governed, searchable
          knowledge shared by people and agents without becoming a separate
          destination to maintain.
        </p>
      </section>

      <section className="mt-12 grid gap-px border bg-border md:grid-cols-3">
        {collections.map((collection) => (
          <article key={collection.title} className="bg-background p-6">
            <p className="text-xs font-medium text-muted-foreground">
              Collection
            </p>
            <h2 className="mt-8 font-medium">{collection.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {collection.description}
            </p>
            <p className="mt-8 text-xs font-medium">Content coming next</p>
          </article>
        ))}
      </section>
    </div>
  )
}
