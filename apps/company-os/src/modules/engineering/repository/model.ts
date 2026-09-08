import { NoteSubject } from "@company/notes/note-subject"
import { defineObject, schema } from "@company/runtime"

import { Root } from "#/model-root.ts"
import { User } from "#/modules/access/user/model.ts"
import { Project } from "#/modules/engineering/project/model.ts"

export const Repository = defineObject({
  id: "repository",
  collection: "repositories",
  name: "Repository",
  pluralName: "Repositories",
  description:
    "A codebase connected to your projects, issues, and pull requests.",
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
