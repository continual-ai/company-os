import { defineLink, defineObject, schema } from "#/runtime/model/index.ts"
import { Connector } from "#/runtime/platform/model/connector.ts"
import { ControllerTarget } from "#/runtime/platform/model/controller-instance.ts"
import { NoteSubject } from "#/runtime/platform/model/note-subject.ts"

export const Connection = defineObject({
  id: "connection",
  collection: "connections",
  name: "Connection",
  pluralName: "Connections",
  description:
    "Select a connector and enter the organization or username and access token. Sync starts automatically and imports only data owned by that account and accessible to the token.",
  implements: [{ interface: ControllerTarget }, { interface: NoteSubject }],
  properties: {
    account: schema.string({
      label: "Organization or username",
      description:
        "Enter the account's username or organization slug, not a display name or URL.",
      minLength: 1,
      maxLength: 300,
    }),
    token: schema.secret({
      label: "Personal access token",
      description:
        "The token must have read access to the data you want to sync. Stored securely; never returned in record reads.",
      nullable: true,
    }),
    status: schema.select({
      label: "Status",
      nullable: true,
      outputOnly: true,
      options: [
        { value: "connected", label: "Connected" },
        { value: "authorizationRequired", label: "Authorization required" },
        { value: "error", label: "Connection error" },
      ],
    }),
    lastError: schema.string({
      label: "Last error",
      nullable: true,
      outputOnly: true,
    }),
    discoveryCursor: schema.string({
      label: "Discovery checkpoint",
      nullable: true,
      outputOnly: true,
    }),
    discoveredAt: schema.timestamp({
      label: "Last discovery",
      nullable: true,
      outputOnly: true,
    }),
  },
  uniqueBy: { account: ["connector", "account"] },
  search: { fields: ["account"] },
  display: {
    title: ["connector.name", "account"],
    status: "status",
    icon: "link",
  },
})

export const ConnectionConnector = defineLink({
  id: "connectionConnector",
  name: "Connection connector",
  from: {
    object: Connection,
    key: "connector",
    label: "Connector",
    min: 1,
    max: 1,
  },
  to: { object: Connector, key: "connections", label: "Connections" },
})
