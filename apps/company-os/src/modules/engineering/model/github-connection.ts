import { defineObject, schema } from "#/runtime/model/index.ts"
import { ControllerTarget } from "#/runtime/platform/model/controller-instance.ts"
import { NoteSubject } from "#/runtime/platform/model/note-subject.ts"

export const GitHubConnection = defineObject({
  id: "githubConnection",
  collection: "githubConnections",
  name: "GitHub connection",
  pluralName: "GitHub connections",
  description:
    "A GitHub account selected for synchronization, with an optional GitHub App installation.",
  implements: [{ interface: ControllerTarget }, { interface: NoteSubject }],
  properties: {
    accountLogin: schema.string({
      label: "Account login",
      minLength: 1,
      maxLength: 100,
    }),
    installationId: schema.string({
      label: "Installation ID",
      minLength: 1,
      maxLength: 100,
      nullable: true,
    }),
  },
  uniqueBy: { installation: ["installationId"] },
  search: { fields: ["accountLogin"] },
  display: { title: "accountLogin", icon: "users" },
})
