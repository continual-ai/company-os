"use client"

import { cn } from "@company/ui/lib/utils"
import * as React from "react"
import { Legend, ResponsiveContainer, Tooltip } from "recharts"

/**
 * Maps a series key to its label and color. Colors default to the theme's
 * `--chart-1` through `--chart-5` tokens in declaration order.
 */
type ChartConfig = Record<
  string,
  {
    label: string
    color?: string
  }
>

interface ChartPayloadItem {
  color?: string
  dataKey?: string | number
  name?: string | number
  value?: string | number
}

/**
 * Sizes the chart and exposes each configured series color as
 * `--color-<key>` so series elements can reference it.
 */
function ChartContainer({
  config,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  config: ChartConfig
  children: React.ReactElement
}) {
  const style = Object.fromEntries(
    Object.entries(config).map(([key, value], index) => [
      `--color-${key}`,
      value.color ?? `var(--chart-${index + 1})`,
    ])
  ) as React.CSSProperties

  return (
    <div
      data-slot="chart"
      className={cn("h-72 w-full text-xs", className)}
      style={style}
      {...props}
    >
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  )
}

function ChartTooltip(props: React.ComponentProps<typeof Tooltip>) {
  return <Tooltip cursor={false} {...props} />
}

function ChartTooltipContent({
  active,
  payload,
  label,
  config,
  className,
}: {
  active?: boolean
  payload?: ChartPayloadItem[]
  label?: React.ReactNode
  config: ChartConfig
  className?: string
}) {
  if (!active || payload === undefined || payload.length === 0) return null

  return (
    <div
      data-slot="chart-tooltip"
      className={cn(
        "grid min-w-32 gap-2 rounded-none border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md",
        className
      )}
    >
      {label !== undefined && label !== null && (
        <div className="font-medium">{label}</div>
      )}
      <div className="grid gap-1">
        {payload.map((item) => {
          const key = String(item.dataKey ?? item.name)
          const itemConfig = config[key]
          return (
            <div key={key} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <span
                  className="size-2.5 rounded-none"
                  style={{
                    background:
                      item.color ?? itemConfig?.color ?? `var(--color-${key})`,
                  }}
                />
                <span>{itemConfig?.label ?? item.name}</span>
              </div>
              <span className="font-mono text-foreground tabular-nums">
                {item.value}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ChartLegend(props: React.ComponentProps<typeof Legend>) {
  return <Legend {...props} />
}

function ChartLegendContent({
  payload,
  config,
}: {
  payload?: ChartPayloadItem[]
  config: ChartConfig
}) {
  if (payload === undefined || payload.length === 0) return null

  return (
    <div
      data-slot="chart-legend"
      className="flex flex-wrap items-center justify-center gap-4 text-xs"
    >
      {payload.map((item) => {
        const key = String(item.dataKey ?? item.value)
        const itemConfig = config[key]
        return (
          <div
            key={key}
            className="flex items-center gap-2 text-muted-foreground"
          >
            <span
              className="size-2.5 rounded-none"
              style={{
                background:
                  item.color ?? itemConfig?.color ?? `var(--color-${key})`,
              }}
            />
            <span>{itemConfig?.label ?? item.value}</span>
          </div>
        )
      })}
    </div>
  )
}

export {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
}
