import { DateTime, Effect } from "effect"

import { GitHub } from "#/modules/engineering/model/github-connector.ts"
import { GitHubRepository } from "#/modules/engineering/model/github-repository.ts"
import { GitHubDiscovery } from "#/modules/engineering/model/github-sync.ts"
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
import { Connector } from "#/runtime/platform/model/connector.ts"
import { Database, defineControllerServer } from "#/runtime/server/index.ts"

export const githubDiscovery = defineControllerServer(GitHubDiscovery, {
  reconcile: Effect.fn("githubDiscovery.reconcile")(function* (id) {
    const database = yield* Database
    const connections = database.repository(Connection)
    const connection = yield* connections
      .get({ id })
      .pipe(Effect.catchTag("ObjectNotFound", () => Effect.succeed(undefined)))
    if (!connection) return undefined
    const connectorId = connection.links.connector
    if (typeof connectorId !== "string") return undefined
    const connector = yield* database
      .repository(Connector)
      .get({ id: RecordId("connector")(connectorId) })
    if (connector.definitionId !== GitHub.id) return undefined
    return yield* withGitHubConnection(
      id,
      (error) =>
        Effect.gen(function* () {
          const current = yield* connections.get({ id })
          const status = error
            ? error.reason === "authorization"
              ? "authorizationRequired"
              : "error"
            : "connected"
          const lastError = error?.message ?? null
          if (current.status !== status || current.lastError !== lastError)
            yield* connections.update({ id, status, lastError })
        }),
      (github) =>
        Effect.gen(function* () {
          const response = yield* githubRequest((signal) =>
            github.rest.repos.listForAuthenticatedUser({
              per_page: 100,
              page: Number(connection.discoveryCursor ?? "1"),
              sort: "full_name",
              direction: "asc",
              request: { signal },
            })
          )
          const more = response.headers.link?.includes('rel="next"') ?? false
          return yield* database.transaction(() =>
            Effect.gen(function* () {
              const table = database.table(Connection)
              yield* database.sql`select id from ${table} where id = ${id} for update`
              const current = yield* connections.get({ id })
              // Credential/configuration edits invalidate work fetched outside the transaction.
              if (current.etag !== connection.etag)
                return { requeueAfter: "5 seconds" as const }
              for (const repo of response.data) {
                if (
                  repo.owner.login.toLowerCase() !==
                  connection.account.toLowerCase()
                )
                  continue
                yield* database.repository(GitHubRepository).upsert({
                  alias: RecordAlias(`github:repository:${repo.node_id}`),
                  values: {
                    nodeId: repo.node_id,
                    fullName: repo.full_name,
                    url: WebUrl(repo.html_url),
                    description: repo.description,
                    defaultBranch: repo.default_branch,
                    visibility:
                      repo.visibility === "internal"
                        ? "internal"
                        : repo.private
                          ? "private"
                          : "public",
                    archived: repo.archived,
                  },
                  links: { connection: id },
                })
              }
              yield* connections.update({
                id,
                discoveryCursor: more
                  ? String(Number(connection.discoveryCursor ?? "1") + 1)
                  : null,
                ...(!more
                  ? {
                      discoveredAt: Timestamp(
                        DateTime.formatIso(yield* DateTime.now)
                      ),
                    }
                  : {}),
              })
              return more ? { requeueAfter: "5 seconds" as const } : undefined
            })
          )
        })
    )
  }),
})
