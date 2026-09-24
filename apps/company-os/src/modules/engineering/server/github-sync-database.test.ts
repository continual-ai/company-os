import { Octokit } from "@octokit/rest"
import { Effect, Exit } from "effect"
import { expect } from "vitest"

import {
  GitHubIssue,
  GitHubPullRequest,
  GitHubRepository,
  EngineeringModule,
} from "#/modules/engineering/model/index.ts"
import {
  GitHubClients,
  GitHubConnector,
} from "#/modules/engineering/server/github-connector.ts"
import { githubDiscovery } from "#/modules/engineering/server/github-discovery.ts"
import { githubRepositorySync } from "#/modules/engineering/server/github-repository-sync.ts"
import { EngineeringServer } from "#/modules/engineering/server/index.ts"
import { Task, WorkModule } from "#/modules/work/model/index.ts"
import {
  defineModel,
  RecordAlias,
  Timestamp,
  WebUrl,
} from "#/runtime/model/index.ts"
import { Connection } from "#/runtime/platform/model/connection.ts"
import { connectorAlias } from "#/runtime/platform/model/connector.ts"
import { PlatformModule } from "#/runtime/platform/model/index.ts"
import { seedModuleSettings } from "#/runtime/platform/server/seed.ts"
import {
  Database,
  EventJournal,
  operationsFor,
} from "#/runtime/server/index.ts"
import { anonymousInvocation } from "#/runtime/server/invocation-context.ts"
import { CurrentInvocation } from "#/runtime/server/invocation.ts"
import { testFoundation } from "#/runtime/testing/foundation.ts"

const model = defineModel({
  name: "GitHub sync",
  modules: [PlatformModule, WorkModule, EngineeringModule],
})
const fixture = testFoundation(model, { servers: [EngineeringServer] })
const noop = () => {}

const repoData = {
  node_id: "R_test",
  full_name: "example/platform",
  html_url: "https://github.com/example/platform",
  owner: { login: "example" },
  private: true,
  visibility: "private",
  description: null,
  default_branch: "main",
  archived: false,
}
const issueData = {
  node_id: "I_test",
  number: 1,
  title: "Fix imports",
  body: "Details",
  html_url: "https://github.com/example/platform/issues/1",
  state: "open",
}
const pullData = {
  node_id: "PR_test",
  number: 2,
  title: "Implement imports",
  body: null,
  html_url: "https://github.com/example/platform/pull/2",
  state: "closed",
  merged_at: "2026-09-17T00:00:00Z",
  draft: false,
  head: { sha: "abc" },
}
const json = (
  body: unknown,
  status = 200,
  headers: Record<string, string> = {}
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  })
const clients = (
  handle: (url: URL, options?: RequestInit) => Response | Promise<Response>
) => ({
  create: (token: string) =>
    new Octokit({
      auth: token,
      log: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
      request: {
        fetch: (url: string, options?: RequestInit) =>
          Promise.resolve(handle(new URL(url), options)),
      },
    }),
})
const setup = Effect.gen(function* () {
  const database = yield* Database
  const connection = yield* database.repository(Connection).create({
    account: "example",
    links: { connector: connectorAlias("github") },
    token: "test-token",
  })
  const repository = yield* database.repository(GitHubRepository).create({
    nodeId: "R_test",
    fullName: "example/platform",
    visibility: "private",
    url: WebUrl(repoData.html_url),
    links: { connection: connection.id },
  })
  return {
    database,
    connection: yield* database
      .repository(Connection)
      .get({ id: connection.id }),
    repository,
  }
})

fixture.test(
  "connections sync automatically once credentials are supplied and protect secrets",
  () =>
    Effect.gen(function* () {
      yield* seedModuleSettings()
      const api = yield* operationsFor(model)
      const connection = yield* api.connection.create({
        account: "example",
        links: { connector: connectorAlias("github") },
      })
      let requests = 0
      const provider = clients((_url, options) => {
        requests++
        expect(new Headers(options?.headers).get("authorization")).toBe(
          "token replacement-token"
        )
        return json([])
      })
      yield* githubDiscovery
        .reconcile(connection.id)
        .pipe(Effect.provideService(GitHubClients, provider))
      expect(requests).toBe(0)
      expect((yield* api.connection.get({ id: connection.id })).status).toBe(
        "authorizationRequired"
      )
      yield* api.connection.update({
        id: connection.id,
        token: "replacement-token",
      })
      yield* githubDiscovery
        .reconcile(connection.id)
        .pipe(Effect.provideService(GitHubClients, provider))
      expect(requests).toBe(1)
      const current = yield* api.connection.get({ id: connection.id })
      expect(current).toMatchObject({
        token: { hint: null },
        status: "connected",
        lastError: null,
        discoveryCursor: null,
      })
      expect(current.discoveredAt).not.toBeNull()
      expect(
        JSON.stringify(yield* (yield* EventJournal).list({}))
      ).not.toContain("replacement-token")
      expect(
        (yield* GitHubConnector.client(connection.id).pipe(
          Effect.provideService(CurrentInvocation, anonymousInvocation),
          Effect.flip
        ))._tag
      ).toBe("ProjectAccessRequired")
      yield* api.connection.update({ id: connection.id, token: null })
      yield* githubDiscovery
        .reconcile(connection.id)
        .pipe(Effect.provideService(GitHubClients, provider))
      expect(requests).toBe(1)
    })
)

fixture.test(
  "discovery resumes pages, filters account ownership, and preserves identity across renames",
  () =>
    Effect.gen(function* () {
      yield* seedModuleSettings()
      const database = yield* Database
      const connection = yield* database.repository(Connection).create({
        account: "example",
        links: { connector: connectorAlias("github") },
        token: "test-token",
      })
      const pages: string[] = []
      let renamed = false
      const provider = clients((url) => {
        pages.push(url.searchParams.get("page")!)
        return json(
          url.searchParams.get("page") === "1"
            ? [
                {
                  ...repoData,
                  full_name: renamed ? "example/renamed" : repoData.full_name,
                },
                {
                  ...repoData,
                  node_id: "other",
                  owner: { login: "different" },
                },
              ]
            : [],
          200,
          url.searchParams.get("page") === "1"
            ? { link: '<https://api.github.com/user/repos?page=2>; rel="next"' }
            : {}
        )
      })
      const run = githubDiscovery
        .reconcile(connection.id)
        .pipe(Effect.provideService(GitHubClients, provider))
      expect(yield* run).toEqual({ requeueAfter: "5 seconds" })
      const imported = (yield* database.repository(GitHubRepository).list({}))
        .items
      expect(imported).toHaveLength(1)
      const repository = imported[0]!
      yield* run
      renamed = true
      yield* run
      const updated = yield* database
        .repository(GitHubRepository)
        .get({ id: repository.id })
      expect(updated).toMatchObject({
        fullName: "example/renamed",
      })
      expect(pages).toEqual(["1", "2", "1"])
      expect(
        (yield* database.repository(GitHubRepository).list({})).items
      ).toHaveLength(1)
    })
)

fixture.test(
  "imports issues and PRs atomically, resumes failed pages, and preserves product links on later updates",
  () =>
    Effect.gen(function* () {
      yield* seedModuleSettings()
      const { database, repository } = yield* setup
      let fail = false
      let completed = false
      const requested: URL[] = []
      const provider = clients((url) => {
        requested.push(url)
        if (url.pathname.endsWith("/pulls/2")) return json(pullData)
        if (fail) return json({ message: "private body must not escape" }, 500)
        if (url.searchParams.get("page") === "2") return json([])
        return json(
          [
            { ...issueData, state: completed ? "closed" : "open" },
            { ...issueData, node_id: "PR_test", number: 2, pull_request: {} },
          ],
          200,
          !completed
            ? {
                link: '<https://api.github.com/repos/example/platform/issues?page=2>; rel="next"',
              }
            : {}
        )
      })
      const run = githubRepositorySync
        .reconcile(repository.id)
        .pipe(Effect.provideService(GitHubClients, provider))
      expect(yield* run).toEqual({ requeueAfter: "5 seconds" })
      expect(
        (yield* database
          .repository(GitHubRepository)
          .get({ id: repository.id })).syncPage
      ).toBe(2)
      const issues = database.repository(GitHubIssue)
      const imported = yield* issues.get({
        id: RecordAlias("github:issue:I_test"),
      })
      const internal = yield* database
        .repository(Task)
        .create({ title: "Internal priority" })
      yield* issues.update({
        id: imported.id,
        links: { tasks: [internal.id] },
      })
      expect((yield* issues.list({})).items).toHaveLength(1)
      expect(
        (yield* database.repository(GitHubPullRequest).list({})).items[0]
      ).toMatchObject({
        status: "merged",
        headCommit: "abc",
        review: "unknown",
        checks: "unknown",
      })
      fail = true
      const failed = yield* run.pipe(Effect.exit)
      expect(Exit.isFailure(failed)).toBe(true)
      expect(JSON.stringify(failed)).not.toContain("private body")
      expect(
        (yield* database
          .repository(GitHubRepository)
          .get({ id: repository.id })).syncPage
      ).toBe(2)
      fail = false
      yield* run
      const done = yield* database
        .repository(GitHubRepository)
        .get({ id: repository.id })
      expect(done).toMatchObject({
        syncPage: 1,
        syncStartedAt: null,
        syncSinceAt: null,
      })
      expect(done.syncedAt).not.toBeNull()
      expect(done.fullSyncedAt).not.toBeNull()
      completed = true
      yield* run
      expect(
        requested
          .filter((url) => url.pathname.endsWith("/issues"))
          .at(-1)!
          .searchParams.has("since")
      ).toBe(true)
      const updated = yield* issues.get({ id: imported.id, expand: true })
      expect(updated.state).toBe("closed")
      expect(updated.links.tasks).toMatchObject({
        items: [{ id: internal.id }],
        totalSize: 1,
        totalSizeExact: true,
      })
      const etag = updated.etag
      yield* run
      expect((yield* issues.get({ id: imported.id })).etag).toBe(etag)
      expect(
        (yield* database
          .repository(GitHubRepository)
          .get({ id: repository.id })).syncError
      ).toBeNull()
    })
)

fixture.test(
  "rate limits defer without advancing, denied access preserves records, and invalid pages roll back",
  () =>
    Effect.gen(function* () {
      yield* seedModuleSettings()
      const { database, connection, repository } = yield* setup
      let response = json({}, 429, { "retry-after": "120" })
      const provider = clients(() => response.clone())
      const run = githubRepositorySync
        .reconcile(repository.id)
        .pipe(Effect.provideService(GitHubClients, provider))
      expect(yield* run).toEqual({ requeueAfter: "120 seconds" })
      // Repository failures must not wake all sibling repositories through their connection.
      expect(
        (yield* database.repository(Connection).get({ id: connection.id })).etag
      ).toBe(connection.etag)
      response = json({ message: "private provider error" }, 401)
      yield* run
      expect(
        (yield* database
          .repository(GitHubRepository)
          .get({ id: repository.id })).syncError
      ).toContain("GitHub access is unavailable")
      expect(
        (yield* database
          .repository(GitHubRepository)
          .get({ id: repository.id })).syncPage
      ).toBeNull()
      response = json([
        issueData,
        { ...issueData, node_id: "invalid", number: 3, title: "x".repeat(301) },
      ])
      expect(Exit.isFailure(yield* run.pipe(Effect.exit))).toBe(true)
      expect(
        (yield* database.repository(GitHubIssue).list({})).items
      ).toHaveLength(0)
      expect(
        (yield* database
          .repository(GitHubRepository)
          .get({ id: repository.id })).syncedAt
      ).toBeNull()
    })
)

fixture.test(
  "does not commit an in-flight page after its token is removed",
  () =>
    Effect.gen(function* () {
      yield* seedModuleSettings()
      const { database, connection, repository } = yield* setup
      let began = noop
      let resume = noop
      const started = new Promise<void>((resolve) => {
        began = resolve
      })
      const finish = new Promise<void>((resolve) => {
        resume = resolve
      })
      let requests = 0
      const provider = clients(async () => {
        requests++
        began()
        await finish
        return json([issueData])
      })
      const run = githubRepositorySync
        .reconcile(repository.id)
        .pipe(Effect.provideService(GitHubClients, provider))
      yield* Effect.all(
        [
          run,
          Effect.gen(function* () {
            yield* Effect.promise(() => started)
            yield* database
              .repository(Connection)
              .update({ id: connection.id, token: null })
            resume()
          }),
        ],
        { concurrency: "unbounded" }
      )
      expect(
        (yield* database.repository(GitHubIssue).list({})).items
      ).toHaveLength(0)
      expect(
        (yield* database
          .repository(GitHubRepository)
          .get({ id: repository.id })).syncPage
      ).toBeNull()
      yield* run
      expect(requests).toBe(1)
    })
)

fixture.test(
  "managed snapshots are idempotent, reject stale configuration and preserve local links",
  () =>
    Effect.gen(function* () {
      yield* seedModuleSettings()
      const { database, repository, connection } = yield* setup
      const api = yield* operationsFor(model)
      const snapshot = {
        id: repository.id,
        etag: repository.etag,
        nodeId: repository.nodeId,
        fullName: "example/renamed",
        url: WebUrl("https://github.com/example/renamed"),
        description: "Upstream description",
        defaultBranch: "main",
        visibility: "private" as const,
        archived: false,
        sourceUpdatedAt: Timestamp("2026-09-20T00:00:00.000Z"),
      }
      expect(yield* api.githubRepository.applySnapshot(snapshot)).toEqual({
        applied: true,
      })
      expect(yield* api.githubRepository.applySnapshot(snapshot)).toEqual({
        applied: false,
      })
      expect(
        yield* api.githubRepository.applySnapshot({
          ...snapshot,
          sourceUpdatedAt: Timestamp("2026-09-19T00:00:00.000Z"),
        })
      ).toEqual({ applied: false })
      expect(
        yield* api.githubRepository
          .applySnapshot({ ...snapshot, nodeId: "other" })
          .pipe(Effect.isFailure)
      ).toBe(true)
      expect(
        yield* api.githubRepository
          .applySnapshot({
            ...snapshot,
            sourceUpdatedAt: Timestamp("2026-09-21T00:00:00.000Z"),
          })
          .pipe(Effect.isFailure)
      ).toBe(true)
      const saved = yield* database
        .repository(GitHubRepository)
        .get({ id: repository.id })
      expect(saved.fullName).toBe("example/renamed")
      expect(saved.links.connection).toBe(connection.id)
    })
)
