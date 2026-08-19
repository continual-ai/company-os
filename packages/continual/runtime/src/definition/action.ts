import type { ApiError, DefinedError } from "./error"
import { definitionId } from "./identity"
import type { DefinedObject } from "./object"
import type { AnySchema, InferSchema, RecordId } from "./schema"

export interface DefinedAction<
  TId extends string = string,
  TVerb extends string = string,
  TSubjectId extends string = string,
  TInput extends AnySchema = AnySchema,
  TOutput extends AnySchema = AnySchema,
  TErrors extends ReadonlyArray<DefinedError> = ReadonlyArray<DefinedError>,
> {
  description?: string
  errors: TErrors
  id: TId
  input: TInput
  kind: "action"
  name: string
  output: TOutput
  subjectId: TSubjectId
  verb: TVerb
}

export type ActionInput<TAction extends DefinedAction> = InferSchema<
  TAction["input"]
>

export type ActionOutput<TAction extends DefinedAction> = InferSchema<
  TAction["output"]
>

export type ActionError<TAction extends DefinedAction> = ApiError<
  TAction["errors"][number]
>

export type ActionSubjectId<TAction extends DefinedAction> = RecordId<
  TAction["subjectId"]
>

export function defineAction<
  const TId extends string,
  const TVerb extends string,
  const TSubject extends DefinedObject,
  const TInput extends AnySchema,
  const TOutput extends AnySchema,
  const TErrors extends ReadonlyArray<DefinedError>,
>(definition: {
  description?: string
  errors: TErrors
  id: TId
  input: TInput
  name: string
  output: TOutput
  subject: TSubject
  verb: TVerb
}): DefinedAction<TId, TVerb, TSubject["id"], TInput, TOutput, TErrors> {
  const { subject, ...action } = definition
  const errorCodes = action.errors.map((error) => error.code)
  const duplicateError = errorCodes.find(
    (code, index) => errorCodes.indexOf(code) !== index
  )

  if (duplicateError) {
    throw new Error(
      `Action '${action.id}' declares error '${duplicateError}' more than once.`
    )
  }

  return {
    kind: "action",
    ...action,
    id: definitionId(action.id),
    subjectId: subject.id,
    verb: definitionId(action.verb),
  }
}
