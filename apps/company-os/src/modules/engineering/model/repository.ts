import { NoteSubject } from "#/modules/notes/model/index.ts"
import { Project } from "#/modules/product/model/project.ts"
import { User } from "#/runtime/access/model/index.ts"
import { defineLink, defineObject, schema } from "#/runtime/model/index.ts"

export const Repository = defineObject({
  id: "repository",
  collection: "repositories",
  name: "Repository",
  pluralName: "Repositories",
  description:
    "A codebase connected to your projects, issues, and pull requests.",
  implements: [{ interface: NoteSubject }],
  properties: {
    name: schema.string({ label: "Name", maxLength: 300, minLength: 1 }),
    url: schema.url({ label: "URL", nullable: true }),
    defaultBranch: schema.string({
      label: "Default branch",
      default: "main",
      maxLength: 200,
    }),
  },
  search: { fields: ["name", "url"] },
  display: { title: "name", icon: "code" },
})

export const RepositoryProjects = defineLink({
  id: "repositoryProjects",
  name: "Repository projects",
  from: { type: Repository, key: "projects", label: "Projects" },
  to: { type: Project, key: "repositories", label: "Repositories" },
})

export const RepositoryOwner = defineLink({
  id: "repositoryOwner",
  name: "Repository Owner",
  from: { type: Repository, key: "owner", label: "Owner", max: 1 },
  to: { type: User, key: "repositories", label: "Repositories" },
})
