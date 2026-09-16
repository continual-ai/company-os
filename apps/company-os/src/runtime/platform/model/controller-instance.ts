import {
  defineInterface,
  defineLink,
  defineObject,
  RecordAlias,
  schema,
} from "#/runtime/model/index.ts"
import { Controller } from "#/runtime/platform/model/controller.ts"

export const ControllerTarget = defineInterface({
  id: "controllerTarget",
  name: "Controller target",
  pluralName: "Controller targets",
  description: "A record maintained by controllers.",
})

export const ControllerInstance = defineObject({
  id: "controllerInstance",
  collection: "controllerInstances",
  name: "Controller instance",
  pluralName: "Controller instances",
  description:
    "The current reconciliation state of one controller for one record, or its whole collection.",
  properties: {
    state: schema.select({
      label: "State",
      default: "pending",
      options: [
        { value: "pending", label: "Pending", color: "yellow" },
        { value: "running", label: "Running", color: "blue" },
        { value: "idle", label: "Idle", color: "green" },
        { value: "error", label: "Error", color: "red" },
      ],
    }),
    runs: schema.number({
      label: "Runs",
      integer: true,
      minimum: 0,
      default: 0,
    }),
    failures: schema.number({
      label: "Failures",
      integer: true,
      minimum: 0,
      default: 0,
    }),
    lastStartedAt: schema.timestamp({ label: "Last started", nullable: true }),
    lastSucceededAt: schema.timestamp({
      label: "Last succeeded",
      nullable: true,
    }),
    requeueAt: schema.timestamp({ label: "Next run", nullable: true }),
    lastError: schema.string({
      label: "Last error",
      nullable: true,
      maxLength: 8000,
    }),
    agentSessionId: schema.string({
      label: "Agent session ID",
      nullable: true,
    }),
    agentSessionUrl: schema.string({
      label: "Agent session URL",
      nullable: true,
    }),
  },
  uniqueBy: { target: ["controller", "record"] },
  actions: { create: false, update: false, delete: false, batchDelete: false },
  display: { title: ["controller.name"], status: "state", icon: "refreshCw" },
})

export const ControllerInstanceController = defineLink({
  id: "controllerInstanceController",
  outputOnly: true,
  from: { object: ControllerInstance, key: "controller", min: 1, max: 1 },
  to: {
    object: Controller,
    key: "instances",
    label: "Instances",
    onDelete: "cascade",
  },
})

export const ControllerInstanceRecord = defineLink({
  id: "controllerInstanceRecord",
  outputOnly: true,
  from: { object: ControllerInstance, key: "record", label: "Record", max: 1 },
  to: {
    object: ControllerTarget,
    key: "controllerInstances",
    label: "Controller instances",
    onDelete: "cascade",
  },
})

/** The alias identifies a work item; its relationships are stored only as Links. */
export const controllerInstanceAlias = (definitionId: string, key: string) =>
  RecordAlias(`system:controller-instance:${definitionId}:${key}`)
