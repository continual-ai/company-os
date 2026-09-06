import { useQuery } from "@tanstack/react-query"

import { data } from "@/app-client"

const summaryQuery = data.deal.pipelineSummary({})

/** Shares the model query cache with any loader or component using this request. */
export function PipelineSummary() {
  const { data: value, error } = useQuery(summaryQuery)
  if (error !== null)
    return (
      <p role="alert">
        {error instanceof Error
          ? error.message
          : "Could not load the pipeline summary."}
      </p>
    )
  if (value === undefined) return <output>Loading pipeline…</output>
  if (value.groups.length === 0) return <p>No readable deals.</p>
  return (
    <table className="w-full text-sm">
      <caption className="pb-3 text-left text-muted-foreground">
        All deals you can read, grouped by stage and currency.
      </caption>
      <thead>
        <tr className="border-b text-left">
          <th className="py-2">Stage</th>
          <th className="px-4 text-right">Deals</th>
          <th className="text-right">Value</th>
        </tr>
      </thead>
      <tbody>
        {value.groups.map((group) => (
          <tr
            key={`${group.stage}:${group.currency ?? "unpriced"}`}
            className="border-b last:border-0"
          >
            <td className="py-2 capitalize">{group.stage}</td>
            <td className="px-4 text-right tabular-nums">{group.count}</td>
            <td className="text-right whitespace-nowrap tabular-nums">
              {group.amount === null
                ? "Unpriced"
                : `${group.amount} ${group.currency}`}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
