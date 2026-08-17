import { MODEL_DESCRIPTION_VERSION } from "@continual/model"
import type { DefinedProject, ModelDescription } from "@continual/model"

/** Derives Studio- and API-safe metadata from the live Company Model. */
export function describeModel(project: DefinedProject): ModelDescription {
  return {
    version: MODEL_DESCRIPTION_VERSION,
    project: { id: project.id, name: project.name },
    apps: project.apps.map(({ id, name, source, type }) => ({
      id,
      name,
      source,
      type,
    })),
    modules: project.modules.map((module) => ({
      id: module.id,
      name: module.name,
      objects: module.objects.map((object) => ({
        id: object.id,
        name: object.name,
        pluralName: object.pluralName,
        description: object.description,
        fields: { ...object.fields },
        display: { ...object.display },
      })),
    })),
  }
}
