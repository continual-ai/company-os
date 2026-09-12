// MCP validates JSON inputs and outputs against generated schemas. Unknown is
// confined to this protocol boundary before dispatch to model-typed services.
import {
  createMcpHandler,
  fromJsonSchema,
  hostHeaderValidationResponse,
  type JsonSchemaValidatorResult,
  McpServer,
  originValidationResponse,
  type CreateMcpHandlerOptions,
  type jsonSchemaValidator,
  type McpRequestContext,
} from "@modelcontextprotocol/server"
import { Option, Schema } from "effect"
import type { Effect } from "effect"

import {
  modelOperations,
  type ModelOperation,
} from "#/runtime/contract/operations.ts"
import {
  recordBatchInput,
  recordBatchResult,
  type RecordBatchInput,
} from "#/runtime/contract/record-batch.ts"
import type { ApiError } from "#/runtime/model/definition/error.ts"
import type { ModelCatalog } from "#/runtime/model/definition/model.ts"
import type { CurrentInvocation } from "#/runtime/server/invocation.ts"
import { executeModelOperation } from "#/runtime/server/model-implementation.ts"
import type { Links } from "#/runtime/server/model/link-service.ts"

type ModelMcpOperation = Effect.Effect<unknown, unknown, CurrentInvocation>

type ModelMcpResult =
  | { readonly success: true; readonly value: unknown }
  | { readonly error: ApiError; readonly success: false }

export interface ModelMcpBinding {
  /** Model whose operations become tools; defaults to the implementation's complete model. */
  readonly exposed?: ModelCatalog
  readonly implementation: {
    readonly links: Pick<typeof Links.Service, "link" | "list" | "unlink">
    readonly model: ModelCatalog
    readonly services: Readonly<Record<string, object>>
  }
  readonly batchGetRecords?: (
    input: RecordBatchInput
  ) => Promise<ModelMcpResult>
  readonly name: string
  readonly run: (
    descriptor: ModelOperation,
    operation: ModelMcpOperation
  ) => Promise<ModelMcpResult>
  readonly version: string
}

export type ModelMcpBindingFactory = (
  context: McpRequestContext
) => ModelMcpBinding | Promise<ModelMcpBinding>

export interface ModelMcpRequestPolicy {
  readonly allowedHostnames: ReadonlyArray<string>
  readonly allowedOriginHostnames?: ReadonlyArray<string>
}

function toolResult(output: unknown) {
  // Model operations expose struct outputs, including an empty struct for void.
  if (output !== undefined && (typeof output !== "object" || output === null)) {
    throw new Error("A model MCP operation returned a non-object result.")
  }
  const structuredContent =
    output === undefined ? {} : Object.fromEntries(Object.entries(output))
  return {
    content: [
      { type: "text" as const, text: JSON.stringify(structuredContent) },
    ],
    structuredContent,
  }
}

function toolResponse(result: ModelMcpResult) {
  if (result.success) return toolResult(result.value)
  return {
    content: [{ type: "text" as const, text: JSON.stringify(result.error) }],
    isError: true,
  }
}

function mcpSchema(schema: Schema.Codec<unknown, unknown>) {
  // The SDK requires an object at the JSON Schema root; a root $ref makes it
  // wrap otherwise identical outputs in { result }. Keep names on nested schemas.
  const standard = Schema.toStandardJSONSchemaV1(
    schema.annotate({ identifier: undefined })
  )
  const decode = Schema.decodeUnknownOption(schema)
  const validator: jsonSchemaValidator = {
    getValidator:
      <T>() =>
      (input: unknown): JsonSchemaValidatorResult<T> => {
        const decoded = decode(input)
        if (Option.isNone(decoded)) {
          return {
            data: undefined,
            errorMessage: "Value does not satisfy the model schema.",
            valid: false,
          }
        }
        return {
          // SAFETY: the Effect schema above validated and decoded this value;
          // T is the matching Standard Schema result requested by the MCP SDK.
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion
          data: decoded.value as T,
          errorMessage: undefined,
          valid: true,
        }
      },
  }
  return fromJsonSchema(
    standard["~standard"].jsonSchema.input({ target: "draft-2020-12" }),
    validator
  )
}

/** Projects every query and action in a model implementation as an MCP tool. */
export function createModelMcpServer({
  implementation,
  exposed = implementation.model,
  name,
  run,
  version,
  batchGetRecords,
}: ModelMcpBinding): McpServer {
  const server = new McpServer({
    name,
    version,
  })

  if (batchGetRecords)
    server.registerTool(
      "records.batchGet",
      {
        title: "Get records by ID",
        description:
          "Hydrate IDs of any active object type. Returns canonical records in input order, deduplicated, with missingIds for unavailable records.",
        inputSchema: mcpSchema(recordBatchInput),
        outputSchema: mcpSchema(recordBatchResult(exposed)),
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      async (input) =>
        toolResponse(
          await batchGetRecords(
            Schema.decodeUnknownSync(recordBatchInput)(input)
          )
        )
    )
  for (const operation of modelOperations(exposed)) {
    server.registerTool(
      operation.key,
      {
        title: operation.name,
        description: operation.description,
        inputSchema: mcpSchema(operation.input),
        outputSchema: mcpSchema(operation.output),
        annotations: {
          destructiveHint: operation.destructive,
          idempotentHint: operation.idempotent,
          openWorldHint: false,
          readOnlyHint: operation.kind === "query",
        },
      },
      async (input: unknown) =>
        toolResponse(
          await run(
            operation,
            executeModelOperation(implementation, operation, input)
          )
        )
    )
  }

  return server
}

/** Creates the official web-standard MCP HTTP handler from per-request bindings. */
export function createModelMcpHandler(
  binding: ModelMcpBindingFactory,
  options?: CreateMcpHandlerOptions
) {
  return createMcpHandler(
    async (context) => createModelMcpServer(await binding(context)),
    options
  )
}

/** Applies the SDK's fail-closed Host and Origin checks to a mounted request. */
export function validateModelMcpRequest(
  request: Request,
  policy: ModelMcpRequestPolicy
): Response | undefined {
  return (
    hostHeaderValidationResponse(request, [...policy.allowedHostnames]) ??
    originValidationResponse(request, [
      ...(policy.allowedOriginHostnames ?? policy.allowedHostnames),
    ])
  )
}
