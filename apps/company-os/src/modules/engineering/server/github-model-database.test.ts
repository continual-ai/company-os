import { Effect } from "effect"
import { expect } from "vitest"

import {
  EngineeringModule,
  GitHubIssue,
  GitHubPullRequest,
  GitHubRepository,
} from "#/modules/engineering/model/index.ts"
import { EngineeringServer } from "#/modules/engineering/server/index.ts"
import { Task, WorkModule } from "#/modules/work/model/index.ts"
import { defineModel, WebUrl } from "#/runtime/model/index.ts"
import { Connection } from "#/runtime/platform/model/connection.ts"
import { connectorAlias } from "#/runtime/platform/model/connector.ts"
import { PlatformModule } from "#/runtime/platform/model/index.ts"
import { seedModuleSettings } from "#/runtime/platform/server/seed.ts"
import { Database } from "#/runtime/server/index.ts"
import { testFoundation } from "#/runtime/testing/foundation.ts"

const fixture = testFoundation(
  defineModel({
    name: "GitHub model test",
    modules: [PlatformModule, WorkModule, EngineeringModule],
  }),
  { servers: [EngineeringServer] }
)

const repositoryInput = {
  nodeId: "R_example",
  fullName: "example/platform",
  visibility: "private" as const,
  url: WebUrl("https://github.com/example/platform"),
}

fixture.test(
  "keeps GitHub issues distinct from product planning and expands their links",
  () =>
    Effect.gen(function* () {
      yield* seedModuleSettings()
      const records = yield* Database
      const connection = yield* records.repository(Connection).create({
        account: "example",
        links: { connector: connectorAlias("github") },
      })
      const repository = yield* records.repository(GitHubRepository).create({
        ...repositoryInput,
        links: { connection: connection.id },
      })
      const task = yield* records
        .repository(Task)
        .create({ title: "Improve imports", status: "planned" })
      const githubIssue = yield* records.repository(GitHubIssue).create({
        nodeId: "I_example",
        number: 1,
        title: "Import timeout",
        state: "closed",
        url: WebUrl("https://github.com/example/platform/issues/1"),
        links: { repository: repository.id, tasks: [task.id] },
      })
      const pr = yield* records.repository(GitHubPullRequest).create({
        nodeId: "PR_example",
        number: 2,
        title: "Fix imports",
        url: WebUrl("https://github.com/example/platform/pull/2"),
        links: {
          repository: repository.id,
          githubIssues: [githubIssue.id],
          tasks: [task.id],
        },
      })
      expect(
        (yield* records
          .repository(Connection)
          .get({ id: connection.id, expand: true })).links.repositories
      ).toMatchObject({
        items: [{ id: repository.id }],
        totalSize: 1,
        totalSizeExact: true,
      })
      const expanded = yield* records
        .repository(GitHubRepository)
        .get({ id: repository.id, expand: true })
      expect(expanded.links.issues).toMatchObject({
        items: [{ id: githubIssue.id }],
        totalSize: 1,
        totalSizeExact: true,
      })
      expect(expanded.links.pullRequests).toMatchObject({
        items: [{ id: pr.id }],
        totalSize: 1,
        totalSizeExact: true,
      })
      const internal = yield* records
        .repository(Task)
        .get({ id: task.id, expand: true })
      expect(internal.status).toBe("planned")
      expect(internal.links.githubIssues).toMatchObject({
        items: [{ id: githubIssue.id }],
        totalSize: 1,
        totalSizeExact: true,
      })
      expect(internal.links.githubPullRequests).toMatchObject({
        items: [{ id: pr.id }],
        totalSize: 1,
        totalSizeExact: true,
      })
      yield* records
        .repository(GitHubIssue)
        .update({ id: githubIssue.id, links: { tasks: [] } })
      expect(
        (yield* records.repository(Task).get({ id: task.id })).status
      ).toBe("planned")
    })
)

fixture.test(
  "enforces stable GitHub identities and repository-local issue and PR numbers",
  () =>
    Effect.gen(function* () {
      yield* seedModuleSettings()
      const records = yield* Database
      const connections = records.repository(Connection)
      const connection = yield* connections.create({
        account: "example",
        links: { connector: connectorAlias("github") },
      })
      expect(
        yield* connections
          .create({
            account: "example",
            links: { connector: connectorAlias("github") },
          })
          .pipe(Effect.flip)
      ).toMatchObject({ _tag: "ObjectUniqueConflict" })
      const repos = records.repository(GitHubRepository)
      const repository = yield* repos.create({
        ...repositoryInput,
        links: { connection: connection.id },
      })
      yield* repos.update({
        id: repository.id,
        fullName: "example/renamed",
        url: WebUrl("https://github.com/example/renamed"),
      })
      expect(
        yield* repos
          .create({ ...repositoryInput, links: { connection: connection.id } })
          .pipe(Effect.flip)
      ).toMatchObject({ _tag: "ObjectUniqueConflict" })
      const other = yield* repos.create({
        ...repositoryInput,
        nodeId: "R_other",
        fullName: "example/other",
        links: { connection: connection.id },
      })
      const issues = records.repository(GitHubIssue)
      const issueInput = {
        nodeId: "I_one",
        number: 1,
        title: "First issue",
        url: WebUrl("https://github.com/example/renamed/issues/1"),
        links: { repository: repository.id },
      }
      yield* issues.create(issueInput)
      expect(
        yield* issues
          .create({ ...issueInput, nodeId: "I_duplicate" })
          .pipe(Effect.flip)
      ).toMatchObject({ _tag: "ObjectUniqueConflict" })
      expect(
        yield* issues.create({ ...issueInput, number: 2 }).pipe(Effect.flip)
      ).toMatchObject({ _tag: "ObjectUniqueConflict" })
      yield* issues.create({
        ...issueInput,
        nodeId: "I_other",
        links: { repository: other.id },
      })
      const prs = records.repository(GitHubPullRequest)
      const prInput = {
        nodeId: "PR_one",
        number: 2,
        title: "First PR",
        url: WebUrl("https://github.com/example/renamed/pull/2"),
        links: { repository: repository.id },
      }
      yield* prs.create(prInput)
      expect(
        yield* prs
          .create({ ...prInput, nodeId: "PR_duplicate" })
          .pipe(Effect.flip)
      ).toMatchObject({ _tag: "ObjectUniqueConflict" })
      expect(
        yield* prs.create({ ...prInput, number: 3 }).pipe(Effect.flip)
      ).toMatchObject({ _tag: "ObjectUniqueConflict" })
      yield* prs.create({
        ...prInput,
        nodeId: "PR_other",
        links: { repository: other.id },
      })
    })
)

fixture.test(
  "requires a connection for repositories and a repository for imported issues and PRs",
  () =>
    Effect.gen(function* () {
      yield* seedModuleSettings()
      const records = yield* Database
      expect(
        yield* records
          .repository(GitHubRepository)
          .create(repositoryInput)
          .pipe(Effect.flip)
      ).toMatchObject({ _tag: "RequiredLinkMissing" })
      expect(
        yield* records
          .repository(GitHubIssue)
          .create({
            nodeId: "I_orphan",
            number: 1,
            title: "Orphan",
            url: WebUrl("https://github.com/example/platform/issues/1"),
          })
          .pipe(Effect.flip)
      ).toMatchObject({ _tag: "RequiredLinkMissing" })
      expect(
        yield* records
          .repository(GitHubPullRequest)
          .create({
            nodeId: "PR_orphan",
            number: 2,
            title: "Orphan",
            url: WebUrl("https://github.com/example/platform/pull/2"),
          })
          .pipe(Effect.flip)
      ).toMatchObject({ _tag: "RequiredLinkMissing" })
    })
)
