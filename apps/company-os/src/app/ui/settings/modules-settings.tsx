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
import { Switch } from "@company/ui/switch"
import { toast } from "@company/ui/toast"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { LoaderCircleIcon, LockKeyholeIcon, SearchIcon } from "lucide-react"
import { useState } from "react"

import { data } from "#/app/app-client.ts"
import { moduleCatalogQuery } from "#/app/ui/application/active-presentation.ts"
import {
  SettingsPage,
  SettingsRow,
  SettingsSection,
} from "#/app/ui/settings/settings-page.tsx"
import { moduleActivationPlan } from "#/modules/platform/model/index.ts"
import { useCapabilities } from "#/runtime/ui/model/use-capabilities.ts"

const manage = { permission: "moduleSetting.setEnabled" } as const
const catalogQuery = moduleCatalogQuery

export function ModulesSettings() {
  const catalog = useQuery(catalogQuery)
  const cache = useQueryClient()
  const capabilities = useCapabilities([manage])
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
    `${module.name} ${module.description} ${module.objects.join(" ")}`
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
    <SettingsPage
      title="Modules"
      description="Choose what your company uses. Turning a module off hides its features and keeps its records."
    >
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
                      <SettingsRow
                        key={module.id}
                        title={module.name}
                        description={module.description}
                        className="flex-row items-center gap-6"
                      >
                        {required ? (
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <LockKeyholeIcon className="size-3" />
                            Always on
                          </span>
                        ) : (
                          <div className="flex items-center gap-3">
                            <span className="size-3.5" aria-hidden="true">
                              {saving ? (
                                <LoaderCircleIcon className="size-3.5 animate-spin text-muted-foreground" />
                              ) : null}
                            </span>
                            <Switch
                              aria-label={module.name}
                              aria-busy={saving}
                              checked={
                                saving
                                  ? change.variables!.enabled
                                  : module.enabled
                              }
                              disabled={!capabilities.can(manage)}
                              readOnly={change.isPending}
                              onCheckedChange={(enabled) =>
                                toggle(module.id, enabled)
                              }
                            />
                          </div>
                        )}
                      </SettingsRow>
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
            {!capabilities.loading && !capabilities.can(manage) ? (
              <p className="text-xs text-muted-foreground">
                An administrator can change module availability.
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
