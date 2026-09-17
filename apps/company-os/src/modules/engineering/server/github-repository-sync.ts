import { Clock, DateTime, Effect } from "effect"

import { GitHubIssue } from "#/modules/engineering/model/github-issue.ts"
import { GitHubPullRequest } from "#/modules/engineering/model/github-pull-request.ts"
import { GitHubRepository } from "#/modules/engineering/model/github-repository.ts"
import { GitHubRepositorySync } from "#/modules/engineering/model/github-sync.ts"
import {
  githubRequest,
  withGitHubConnection,
} from "#/modules/engineering/server/github-connector.ts"
import {
  RecordAlias,
  RecordId,
  Timestamp,
  WebUrl,
} from "#/runtime/model/index.ts"
import { Connection } from "#/runtime/platform/model/connection.ts"
import { Database, defineControllerServer } from "#/runtime/server/index.ts"

const fullSyncInterval = 24 * 60 * 60 * 1000

export const githubRepositorySync = defineControllerServer(
  GitHubRepositorySync,
  {
    reconcile: Effect.fn("githubRepositorySync.reconcile")(function* (id) {
      const database = yield* Database
      const repositories = database.repository(GitHubRepository)
      const repository = yield* repositories
        .get({ id })
        .pipe(
          Effect.catchTag("ObjectNotFound", () => Effect.succeed(undefined))
        )
      if (!repository) return undefined
      const connectionId = repository.links.connection
      if (typeof connectionId !== "string") return undefined
      const connection = yield* database
        .repository(Connection)
        .get({ id: RecordId("connection")(connectionId) })
      const [owner, repo] = repository.fullName.split("/")
      if (!owner || !repo) return undefined
      return yield* withGitHubConnection(
        connection.id,
        (error) =>
          Effect.gen(function* () {
            const current = yield* repositories.get({ id })
            const syncError = error?.message ?? null
            if (current.syncError !== syncError)
              yield* repositories.update({ id, syncError })
          }),
        (github) =>
          Effect.gen(function* () {
            const startedAt =
              repository.syncStartedAt ??
              Timestamp(DateTime.formatIso(yield* DateTime.now))
            const full =
              !repository.fullSyncedAt ||
              (yield* Clock.currentTimeMillis) -
                Date.parse(repository.fullSyncedAt) >=
                fullSyncInterval
            const since = repository.syncStartedAt
              ? repository.syncSinceAt
              : !full && repository.syncedAt
                ? Timestamp(
                    DateTime.formatIso(
                      DateTime.subtract(
                        DateTime.makeUnsafe(repository.syncedAt),
                        { minutes: 5 }
                      )
                    )
                  )
                : null
            // The issues feed includes PRs and supports updated-since filtering. Fetch PR details
            // separately for draft/merged state and head SHA; review/check evidence stays unknown.
            const response = yield* githubRequest((signal) =>
              github.rest.issues.listForRepo({
                owner,
                repo,
                state: "all",
                sort: since ? "updated" : "created",
                direction: "asc",
                per_page: 25,
                page: repository.syncPage ?? 1,
                ...(since ? { since } : {}),
                request: { signal },
              })
            )
            const pulls = yield* Effect.forEach(
              response.data.filter((issue) => issue.pull_request !== undefined),
              (issue) =>
                githubRequest((signal) =>
                  github.rest.pulls.get({
                    owner,
                    repo,
                    pull_number: issue.number,
                    request: { signal },
                  })
                ),
              { concurrency: 2 }
            )
            const more = response.headers.link?.includes('rel="next"') ?? false
            return yield* database.transaction(() =>
              Effect.gen(function* () {
                // Lock configuration in the same order as discovery before committing fetched data.
                yield* database.sql`select id from ${database.table(Connection)} where id = ${connection.id} for update`
                yield* database.sql`select id from ${database.table(GitHubRepository)} where id = ${id} for update`
                const currentConnection = yield* database
                  .repository(Connection)
                  .get({ id: connection.id })
                const current = yield* repositories.get({ id })
                if (
                  current.etag !== repository.etag ||
                  currentConnection.etag !== connection.etag
                )
                  return { requeueAfter: "5 seconds" as const }
                for (const issue of response.data) {
                  if (issue.pull_request) continue
                  yield* database.repository(GitHubIssue).upsert({
                    alias: RecordAlias(`github:issue:${issue.node_id}`),
                    values: {
                      nodeId: issue.node_id,
                      number: issue.number,
                      title: issue.title,
                      body: issue.body ?? null,
                      url: WebUrl(issue.html_url),
                      state: issue.state === "closed" ? "closed" : "open",
                    },
                    links: { repository: id },
                  })
                }
                for (const { data: pr } of pulls) {
                  yield* database.repository(GitHubPullRequest).upsert({
                    alias: RecordAlias(`github:pullRequest:${pr.node_id}`),
                    values: {
                      nodeId: pr.node_id,
                      number: pr.number,
                      title: pr.title,
                      body: pr.body,
                      url: WebUrl(pr.html_url),
                      status: pr.merged_at
                        ? "merged"
                        : pr.state === "closed"
                          ? "closed"
                          : pr.draft
                            ? "draft"
                            : "open",
                      headCommit: pr.head.sha,
                      review: "unknown",
                      checks: "unknown",
                    },
                    links: { repository: id },
                  })
                }
                yield* repositories.update({
                  id,
                  syncPage: more ? (repository.syncPage ?? 1) + 1 : 1,
                  syncStartedAt: more ? startedAt : null,
                  syncSinceAt: more ? since : null,
                  ...(!more
                    ? {
                        syncedAt: startedAt,
                        ...(!since ? { fullSyncedAt: startedAt } : {}),
                      }
                    : {}),
                })
                return more ? { requeueAfter: "5 seconds" as const } : undefined
              })
            )
          })
      )
    }),
  }
)
