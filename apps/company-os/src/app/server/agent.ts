import { tmpdir } from "node:os"
import { join } from "node:path"

import { NodeServices } from "@effect/platform-node"
import { Codex } from "@openai/codex-sdk"
import { Config, Effect, FileSystem, Layer } from "effect"

import { CodexAgent } from "#/runtime/server/codex-agent.ts"

/** Node controller host only. Provider/tool configuration belongs to the application. */
export const agentLayer = Layer.unwrap(
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const workingDirectory = join(tmpdir(), "company-os-agent")
    yield* fs.makeDirectory(workingDirectory, { recursive: true })
    const url = yield* Config.String("COMPANY_OS_MCP_URL").pipe(
      Config.withDefault("http://localhost:3002/api/mcp")
    )
    return CodexAgent.layer(
      new Codex({
        config: { mcp_servers: { company_os: { url, required: true } } },
      }),
      {
        model: "gpt-5.6-luna",
        modelReasoningEffort: "low",
        workingDirectory,
        skipGitRepoCheck: true,
        sandboxMode: "read-only",
        approvalPolicy: "never",
        webSearchMode: "live",
      }
    )
  })
).pipe(Layer.provide(NodeServices.layer))
