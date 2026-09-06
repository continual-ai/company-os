import { defineObject, schema } from "@company/runtime"

import { User } from "#modules/access/user/model"
import { Project } from "#modules/engineering/project/model"
import { NoteSubject } from "#modules/sales/interfaces/note-subject"
import { Root } from "#root"

export const Repository = defineObject({
  id: "repository",
  collection: "repositories",
  name: "Repository",
  pluralName: "Repositories",
  description:
    "A source repository connected to engineering work. Credentials belong to the integration, never this record.",
  parent: Root,
  implements: [{ interface: NoteSubject }],
  properties: {
    name: schema.string({ label: "Name", maxLength: 300, minLength: 1 }),
    url: schema.url({ label: "URL", nullable: true }),
    defaultBranch: schema.string({
      label: "Default branch",
      default: "main",
      maxLength: 200,
    }),
    project: schema.reference(Project, {
      label: "Project",
      nullable: true,
      inverse: { key: "repositories", label: "Repositories" },
    }),
    owner: schema.reference(User, {
      label: "Owner",
      nullable: true,
      inverse: { key: "repositories", label: "Repositories" },
    }),
  },
  search: { fields: ["name", "url"] },
  display: { title: "name", icon: "code" },
})
