/* oxlint-disable anti-slop/no-unknown-parameters, anti-slop/no-unknown-returns, anti-slop/no-unsafe-dictionary-type, typescript/no-unsafe-type-assertion */
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

import type { ApiError } from "./definition/error"
import type { ModelCatalog } from "./definition/model"
import type { ObjectType } from "./definition/object"
import type { Query } from "./definition/query"
import type { LinkService } from "./effect-link-service"
import {
  executableModelOperations,
  executeModelOperation,
  type ExecutableModelOperation,
} from "./effect-model-implementation"
import {
  objectBatchGetInputSchema,
  objectBatchOutputSchema,
  objectGetInputSchema,
  objectListInputSchema,
  objectPageOutputSchema,
  objectRecordOutputSchema,
  pageTotalSizeSchema,
} from "./effect-model-schemas"
import type { CurrentInvocation } from "./effect-object-service"
import {
  toEffectInputSchema,
  toEffectRecordIdentifierSchema,
  toEffectSchema,
} from "./effect-schema"

export type ModelMcpOperation = Effect.Effect<
  unknown,
  unknown,
  CurrentInvocation
>

export type ModelMcpResult =
  | { readonly success: true; readonly value: unknown }
  | { readonly error: ApiError; readonly success: false }

export interface ModelMcpBinding {
  readonly implementation: {
    readonly links: LinkService<unknown, CurrentInvocation>
    readonly model: ModelCatalog
    readonly services: Readonly<Record<string, object>>
  }
  readonly name: string
  readonly run: (
    descriptor: ExecutableModelOperation,
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

function querySchemas(object: ObjectType, query: Query) {
  switch (query.id) {
    case "batchGet":
      return {
        input: objectBatchGetInputSchema(object),
        output: objectBatchOutputSchema(object),
      }
    case "get":
      return {
        input: objectGetInputSchema(object),
        output: objectRecordOutputSchema(object),
      }
    case "list":
      return {
        input: objectListInputSchema(object),
        output: objectPageOutputSchema(object),
      }
  }
  throw new Error(`Unsupported query for object '${query.objectType}'.`)
}

function toolResult(output: unknown) {
  // Model operations expose struct outputs, including an empty struct for void.
  // SAFETY: every model operation has a portable struct output schema.
  const structuredContent =
    output === undefined ? {} : (output as Record<string, unknown>)
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
  const standard = Schema.toStandardJSONSchemaV1(schema)
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
  name,
  run,
  version,
}: ModelMcpBinding): McpServer {
  const server = new McpServer({
    name,
    version,
  })

  for (const descriptor of executableModelOperations(implementation.model)) {
    const { definition, object } = descriptor
    if (descriptor.linkTraversal !== undefined) {
      const traversal = descriptor.linkTraversal
      const input = Schema.Struct({
        id: toEffectRecordIdentifierSchema(object.id),
        ...(definition.id === "list"
          ? {
              pageSize: Schema.optionalKey(Schema.Number),
              pageToken: Schema.optionalKey(Schema.String),
            }
          : {
              target: toEffectRecordIdentifierSchema(
                traversal.target.from.typeId
              ),
            }),
      })
      const output =
        definition.id === "list"
          ? Schema.Struct({
              items: Schema.Array(
                Schema.Struct({ id: Schema.String, objectType: Schema.String })
              ),
              nextPageToken: Schema.String,
              totalSize: pageTotalSizeSchema,
            })
          : Schema.Struct({})
      server.registerTool(
        descriptor.key,
        {
          title: definition.name,
          inputSchema: mcpSchema(input),
          outputSchema: mcpSchema(output),
          annotations: {
            destructiveHint: definition.id === "unlink",
            idempotentHint: definition.id !== "list",
            openWorldHint: false,
            readOnlyHint: definition.kind === "query",
          },
        },
        async (toolInput: unknown) =>
          toolResponse(
            await run(
              descriptor,
              executeModelOperation(implementation, descriptor, toolInput)
            )
          )
      )
      continue
    }
    if (definition.kind === "query") {
      const query = definition
      const schemas = querySchemas(object, query)
      server.registerTool(
        `${object.id}.${query.id}`,
        {
          title: query.name,
          description: query.description,
          inputSchema: mcpSchema(schemas.input),
          outputSchema: mcpSchema(schemas.output),
          annotations: {
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
            readOnlyHint: true,
          },
        },
        async (input: unknown) =>
          toolResponse(
            await run(
              descriptor,
              executeModelOperation(implementation, descriptor, input)
            )
          )
      )
      continue
    }

    const action = definition
    const output = toEffectSchema(action.output)
    server.registerTool(
      `${object.id}.${action.id}`,
      {
        title: action.name,
        description: action.description,
        inputSchema: mcpSchema(toEffectInputSchema(action.input)),
        outputSchema: mcpSchema(output),
        annotations: {
          destructiveHint: action.destructive,
          idempotentHint: action.idempotent,
          openWorldHint: false,
          readOnlyHint: false,
        },
      },
      async (input: unknown) =>
        toolResponse(
          await run(
            descriptor,
            executeModelOperation(implementation, descriptor, input)
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
