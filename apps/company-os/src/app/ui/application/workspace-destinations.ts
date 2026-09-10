import { BlocksIcon } from "lucide-react"

import {
  reportPreviews,
  toolPreviews,
  workspaceModuleOrder,
  workspaceModuleIcons,
} from "#/app/customization/workspace.ts"
import { useModelNavigation } from "#/runtime/ui/model/module-navigation.tsx"

function moduleRank(id: string) {
  const index = workspaceModuleOrder.indexOf(id)
  return index === -1 ? workspaceModuleOrder.length : index
}

export function useWorkspaceDestinations() {
  const { modules } = useModelNavigation()
  const data = modules.flatMap((module) =>
    module.items.map((item) => ({
      label: item.label,
      to: item.to,
      icon: item.icon,
      description: item.description,
      group: module.name,
      moduleId: module.id,
    }))
  )
  const tools = toolPreviews.map((tool) => ({
    ...tool,
    to: `/tools/${tool.id}`,
    group: tool.category,
  }))
  const reports = reportPreviews.map((report) => ({
    ...report,
    to: `/reports/${report.id}`,
    group:
      modules.find((module) => module.id === report.moduleId)?.name ??
      report.moduleId,
  }))
  const groups = modules
    .map((module) => ({
      id: module.id,
      label: module.name,
      icon: workspaceModuleIcons[module.id] ?? BlocksIcon,
      items: [...data, ...tools, ...reports].filter(
        (item) => item.moduleId === module.id
      ),
    }))
    .filter((group) => group.items.length > 0)
    .sort((a, b) => moduleRank(a.id) - moduleRank(b.id))
  return { data, tools, reports, groups }
}
