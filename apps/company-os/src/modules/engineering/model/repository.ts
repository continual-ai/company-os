import { Project } from "#/modules/product/model/project.ts"
import { User } from "#/runtime/access/model/index.ts"
import { defineLink, defineObject, schema } from "#/runtime/model/index.ts"
import { NoteSubject } from "#/runtime/platform/model/note-subject.ts"

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
  from: { object: Repository, key: "projects", label: "Projects" },
  to: { object: Project, key: "repositories", label: "Repositories" },
})

export const RepositoryOwner = defineLink({
  id: "repositoryOwner",
  name: "Repository Owner",
  from: { object: Repository, key: "owner", label: "Owner", max: 1 },
  to: { object: User, key: "repositories", label: "Repositories" },
})
