import { Project } from "#/modules/work/model/project.ts"
import { User } from "#/runtime/access/model/index.ts"
import { defineLink, defineObject, schema } from "#/runtime/model/index.ts"
import { Connection } from "#/runtime/platform/model/connection.ts"
import { ControllerTarget } from "#/runtime/platform/model/controller-instance.ts"
import { NoteSubject } from "#/runtime/platform/model/note-subject.ts"

export const GitHubRepository = defineObject({
  id: "githubRepository",
  collection: "githubRepositories",
  name: "GitHub repository",
  pluralName: "GitHub repositories",
  description:
    "A GitHub repository connected to internal projects and its imported issues and pull requests.",
  implements: [{ interface: ControllerTarget }, { interface: NoteSubject }],
  properties: {
    syncError: schema.string({
      label: "Sync error",
      nullable: true,
      outputOnly: true,
    }),
    syncPage: schema.number({
      label: "Sync page",
      integer: true,
      minimum: 1,
      nullable: true,
      outputOnly: true,
    }),
    syncStartedAt: schema.timestamp({
      label: "Import started",
      nullable: true,
      outputOnly: true,
    }),
    syncSinceAt: schema.timestamp({
      label: "Import changes since",
      nullable: true,
      outputOnly: true,
    }),
    syncedAt: schema.timestamp({
      label: "Last completed sync",
      nullable: true,
      outputOnly: true,
    }),
    fullSyncedAt: schema.timestamp({
      label: "Last full sync",
      nullable: true,
      outputOnly: true,
    }),
    nodeId: schema.string({
      label: "GitHub node ID",
      minLength: 1,
      maxLength: 200,
    }),
    fullName: schema.string({
      label: "Full name",
      minLength: 1,
      maxLength: 300,
    }),
    url: schema.url({ label: "URL" }),
    description: schema.string({
      label: "Description",
      nullable: true,
      maxLength: 10000,
    }),
    defaultBranch: schema.string({
      label: "Default branch",
      nullable: true,
      maxLength: 200,
    }),
    visibility: schema.select({
      label: "Visibility",
      options: [
        { value: "public", label: "Public" },
        { value: "private", label: "Private" },
        { value: "internal", label: "Internal" },
      ],
    }),
    archived: schema.boolean({ label: "Archived", default: false }),
  },
  uniqueBy: { github: ["nodeId"] },
  search: { fields: ["fullName", "description", "url"] },
  display: { title: "fullName", icon: "code" },
})

export const GitHubRepositoryConnection = defineLink({
  id: "githubRepositoryConnection",
  name: "GitHub repository connection",
  from: {
    object: GitHubRepository,
    key: "connection",
    label: "Connection",
    min: 1,
    max: 1,
  },
  to: { object: Connection, key: "repositories", label: "Repositories" },
})

export const GitHubRepositoryProjects = defineLink({
  id: "githubRepositoryProjects",
  name: "GitHub repository projects",
  from: { object: GitHubRepository, key: "projects", label: "Projects" },
  to: {
    object: Project,
    key: "githubRepositories",
    label: "GitHub repositories",
  },
})

export const GitHubRepositoryMaintainer = defineLink({
  id: "githubRepositoryMaintainer",
  name: "GitHub repository maintainer",
  from: {
    object: GitHubRepository,
    key: "maintainer",
    label: "Maintainer",
    max: 1,
  },
  to: { object: User, key: "githubRepositories", label: "GitHub repositories" },
})
