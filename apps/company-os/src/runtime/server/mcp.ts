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

import {
  operationContracts,
  type OperationContract,
} from "#/runtime/contract/operation-contract.ts"
import type { ApiError } from "#/runtime/model/definition/error.ts"
import type { ModelCatalog } from "#/runtime/model/definition/model.ts"

type ModelMcpResult =
  | { readonly success: true; readonly value: unknown }
  | { readonly error: ApiError; readonly success: false }

export interface ModelMcpBinding {
  readonly model: ModelCatalog
  readonly name: string
  readonly run: (
    descriptor: OperationContract,
    input: unknown
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

const schemaCache = new WeakMap<
  Schema.Codec<unknown, unknown>,
  ReturnType<typeof fromJsonSchema>
>()

function mcpSchema(schema: Schema.Codec<unknown, unknown>) {
  const cached = schemaCache.get(schema)
  if (cached) return cached
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
  const result = fromJsonSchema(
    standard["~standard"].jsonSchema.input({ target: "draft-2020-12" }),
    validator
  )
  schemaCache.set(schema, result)
  return result
}

/** Projects every query and action in a model implementation as an MCP tool. */
export function createModelMcpServer({
  model,
  name,
  run,
  version,
}: ModelMcpBinding): McpServer {
  const server = new McpServer({
    name,
    version,
  })

  for (const operation of operationContracts(model)) {
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
      async (input: unknown) => toolResponse(await run(operation, input))
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
