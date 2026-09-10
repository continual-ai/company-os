import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@company/ui/alert-dialog"
import { Button } from "@company/ui/button"
import { Input } from "@company/ui/input"
import { MaturityBadge } from "@company/ui/maturity-badge"
import { Switch } from "@company/ui/switch"
import { toast } from "@company/ui/toast"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowUpRightIcon, LockKeyholeIcon, SearchIcon } from "lucide-react"
import { useState } from "react"

import { data } from "#/app/app-client.ts"
import { moduleCatalogQuery } from "#/app/ui/application/active-presentation.ts"
import {
  SettingsPage,
  SettingsSection,
} from "#/app/ui/settings/settings-page.tsx"
import { moduleActivationPlan } from "#/runtime/platform/model/index.ts"

const catalogQuery = moduleCatalogQuery

export function ModulesSettings() {
  const catalog = useQuery(catalogQuery)
  const cache = useQueryClient()
  const [search, setSearch] = useState("")
  const [confirmationOpen, setConfirmationOpen] = useState(false)
  const [confirmation, setConfirmation] = useState<{
    id: string
    name: string
    dependents: ReadonlyArray<{ id: string; name: string }>
  }>()
  const change = useMutation({
    ...data.moduleSetting.setEnabled(),
    onMutate: () => cache.getQueryData(catalogQuery.queryKey),
    onSuccess: (result, input, before) => {
      cache.setQueryData(
        catalogQuery.queryKey,
        (previous) =>
          previous && {
            modules: previous.modules.map((module) => ({
              ...module,
              enabled: result.enabledModules.includes(module.id),
            })),
          }
      )
      setConfirmationOpen(false)
      const name =
        before?.modules.find((module) => module.id === input.moduleId)?.name ??
        input.moduleId
      const related =
        before?.modules
          .filter(
            (module) =>
              module.id !== input.moduleId &&
              module.enabled !== input.enabled &&
              result.enabledModules.includes(module.id) === input.enabled
          )
          .map((module) => module.name) ?? []
      const verb = input.enabled ? "turned on" : "turned off"
      const details = [
        ...(related.length
          ? [
              `Also ${verb} ${new Intl.ListFormat("en", { style: "long", type: "conjunction" }).format(related)}.`,
            ]
          : []),
        ...(!input.enabled ? ["Existing records are kept."] : []),
      ]
      toast.success(
        `${name} ${verb}`,
        details.length ? { description: details.join(" ") } : undefined
      )
    },
    onError: (error, input, before) => {
      const name =
        before?.modules.find((module) => module.id === input.moduleId)?.name ??
        input.moduleId
      toast.error(`Could not turn ${input.enabled ? "on" : "off"} ${name}`, {
        description: error.message,
      })
    },
  })
  const modules = catalog.data?.modules ?? []
  const matching = modules.filter((module) =>
    `${module.name} ${module.description} ${module.maturity ?? ""} ${module.maintainer?.name ?? ""} ${module.maintainer?.email ?? ""} ${module.origin?.name ?? ""} ${module.objects.join(" ")}`
      .toLowerCase()
      .includes(search.toLowerCase().trim())
  )
  const pending = change.isPending
    ? moduleActivationPlan(
        modules,
        change.variables.moduleId,
        change.variables.enabled
      )
    : []
  const toggle = (id: string, enabled: boolean) => {
    if (change.isPending) return
    const module = modules.find((item) => item.id === id)!
    const affected = moduleActivationPlan(modules, id, enabled)
    const dependents = affected.filter((item) => item.id !== id)
    if (!enabled && dependents.length) {
      setConfirmation({ id, name: module.name, dependents })
      setConfirmationOpen(true)
    } else change.mutate({ moduleId: id, enabled })
  }

  return (
    <SettingsPage description="Choose what your company uses. Turning a module off hides its features and keeps its records.">
      <div className="space-y-6">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            aria-label="Search modules"
            className="pl-9"
            placeholder="Search modules…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        {catalog.data ? (
          <div className="space-y-8">
            {[false, true].map((required) => {
              const items = matching.filter(
                (module) => module.required === required
              )
              return items.length ? (
                <SettingsSection
                  key={String(required)}
                  title={required ? "Core platform" : "Business modules"}
                  description={
                    required
                      ? "These services keep your application running and are always on."
                      : "Related modules are handled together. You’ll review any others that need to turn off."
                  }
                >
                  {items.map((module) => {
                    const saving = pending.some((item) => item.id === module.id)
                    return (
                      <div
                        key={module.id}
                        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 border-b border-border/50 py-3.5 last:border-b-0"
                      >
                        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                          <h3 className="text-sm font-medium">{module.name}</h3>
                          {module.maturity && (
                            <MaturityBadge value={module.maturity} />
                          )}
                        </div>
                        <div className="flex items-center">
                          {required ? (
                            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <LockKeyholeIcon className="size-3" />
                              Always on
                            </span>
                          ) : (
                            <div className="relative flex items-center">
                              <Switch
                                aria-label={module.name}
                                aria-busy={saving}
                                checked={
                                  saving
                                    ? change.variables!.enabled
                                    : module.enabled
                                }
                                readOnly={change.isPending}
                                onCheckedChange={(enabled) =>
                                  toggle(module.id, enabled)
                                }
                              />
                            </div>
                          )}
                        </div>
                        <p className="col-span-2 text-xs leading-5 text-muted-foreground">
                          {module.description}
                        </p>
                        <div className="col-span-2">
                          {(module.maintainer || module.origin) && (
                            <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                              {module.maintainer && (
                                <span>
                                  Maintainer:{" "}
                                  {module.maintainer.email ? (
                                    <a
                                      className="rounded-sm hover:text-foreground underline decoration-border underline-offset-2 hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-ring"
                                      href={`mailto:${module.maintainer.email}`}
                                    >
                                      {module.maintainer.name}
                                    </a>
                                  ) : (
                                    <span>{module.maintainer.name}</span>
                                  )}
                                </span>
                              )}
                              {module.origin && (
                                <span className="inline-flex items-center gap-1">
                                  Origin:{" "}
                                  {module.origin.url ? (
                                    <a
                                      className="inline-flex items-center gap-0.5 rounded-sm hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                                      href={module.origin.url}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      {module.origin.name}
                                      <ArrowUpRightIcon
                                        aria-hidden="true"
                                        className="size-3"
                                      />
                                    </a>
                                  ) : (
                                    module.origin.name
                                  )}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </SettingsSection>
              ) : null
            })}
            {matching.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No modules match “{search}”.
              </p>
            ) : null}
          </div>
        ) : catalog.error ? (
          <div role="alert" className="space-y-3 text-sm">
            <p>Could not load modules.</p>
            <Button variant="outline" onClick={() => void catalog.refetch()}>
              Retry
            </Button>
          </div>
        ) : (
          <output className="text-sm text-muted-foreground">
            Loading modules…
          </output>
        )}
      </div>
      <AlertDialog
        open={confirmationOpen}
        onOpenChange={(open) => {
          if (!change.isPending) setConfirmationOpen(open)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Turn off {confirmation?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              These modules depend on it and will also turn off. All records are
              kept; you can turn modules back on anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="space-y-1 text-sm">
            {confirmation?.dependents.map((module) => (
              <li key={module.id}>{module.name}</li>
            ))}
          </ul>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={change.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={change.isPending}
              onClick={() => {
                if (confirmation)
                  change.mutate({
                    moduleId: confirmation.id,
                    enabled: false,
                    disableDependents: confirmation.dependents.map(
                      (module) => module.id
                    ),
                  })
              }}
            >
              {change.isPending ? "Turning off…" : "Turn off modules"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsPage>
  )
}
