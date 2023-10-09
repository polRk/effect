import type * as Schema from "@effect/schema/Schema"
import * as Effect from "effect/Effect"
import * as Either from "effect/Either"
import { pipe } from "effect/Function"
import type * as client from "../Client"
import { RpcError } from "../Error"
import { RpcResolver } from "../Resolver"
import type { RpcSchema, RpcService } from "../Schema"
import { RpcServiceErrorId, RpcServiceId } from "../Schema"
import * as codec from "./codec"
import * as resolverInternal from "./resolver"
import * as schemaInternal from "./schema"

const unsafeDecode = <S extends RpcService.DefinitionWithId>(schemas: S) => {
  const map = schemaInternal.methodClientCodecsEither(schemas)

  return (method: RpcService.Methods<S>, output: unknown) => {
    const codec = map[method as string].output
    const result = codec ? codec(output) : Either.right(void 0)
    if (result._tag !== "Left") {
      return result.right as unknown
    }

    throw "unsafeDecode fail"
  }
}

const makeRecursive = <S extends RpcService.DefinitionWithId>(
  schemas: S,
  transport: RpcResolver<never>,
  options: client.RpcClientOptions,
  serviceErrors: ReadonlyArray<Schema.Schema<any>> = [],
  prefix = ""
): client.RpcClient<S, never> => {
  serviceErrors = [
    ...serviceErrors,
    schemas[RpcServiceErrorId] as Schema.Schema<any>
  ]

  return Object.entries(schemas).reduce(
    (acc, [method, codec]) => ({
      ...acc,
      [method]: RpcServiceId in codec
        ? makeRecursive(
          codec,
          transport,
          options,
          serviceErrors,
          `${prefix}${method}.`
        )
        : makeRpc(
          transport,
          serviceErrors,
          codec,
          `${prefix}${method}`,
          options
        )
    }),
    {} as any
  )
}

/** @internal */
export const makeWithResolver: {
  <
    S extends RpcService.DefinitionWithSetup,
    Resolver extends
      | RpcResolver<never>
      | Effect.Effect<any, never, RpcResolver<never>>
  >(
    schemas: S,
    resolver: Resolver,
    init: RpcService.SetupInput<S>,
    options?: client.RpcClientOptions
  ): Effect.Effect<
    never,
    RpcService.SetupError<S> | RpcError,
    client.RpcClient<
      S,
      [Resolver] extends [Effect.Effect<any, any, any>] ? Effect.Effect.Context<Resolver>
        : never
    >
  >
  <
    S extends RpcService.DefinitionWithoutSetup,
    Resolver extends
      | RpcResolver<never>
      | Effect.Effect<any, never, RpcResolver<never>>
  >(
    schemas: S,
    resolver: Resolver,
    options?: client.RpcClientOptions
  ): client.RpcClient<
    S,
    [Resolver] extends [Effect.Effect<any, any, any>] ? Effect.Effect.Context<Resolver>
      : never
  >
} = (
  schemas: RpcService.DefinitionWithId,
  resolver: RpcResolver<never> | Effect.Effect<any, never, RpcResolver<never>>,
  initOrOptions?: unknown,
  options?: client.RpcClientOptions
) => {
  const hasSetup = "__setup" in schemas
  const opts = hasSetup ? options : (initOrOptions as client.RpcClientOptions)
  const client: any = {
    ...makeRecursive(schemas, resolver as any, opts ?? {}),
    _schemas: schemas,
    _unsafeDecode: unsafeDecode(schemas)
  }

  if (hasSetup) {
    return Effect.as(client.__setup(initOrOptions), client)
  }

  return client as any
}

/** @internal */
export const make: {
  <S extends RpcService.DefinitionWithSetup>(
    schemas: S,
    init: RpcService.SetupInput<S>,
    options?: client.RpcClientOptions
  ): Effect.Effect<
    never,
    RpcService.SetupError<S> | RpcError,
    client.RpcClient<S, RpcResolver<never>>
  >
  <S extends RpcService.DefinitionWithoutSetup>(
    schemas: S,
    options?: client.RpcClientOptions
  ): client.RpcClient<S, RpcResolver<never>>
} = (
  schemas: any,
  initOrOptions?: unknown,
  options?: client.RpcClientOptions
) => makeWithResolver(schemas, RpcResolver, initOrOptions, options) as any

const makeRpc = <S extends RpcSchema.Any>(
  resolver: RpcResolver<never>,
  serviceErrors: ReadonlyArray<Schema.Schema<any>>,
  schema: S,
  method: string,
  { spanPrefix = "RpcClient" }: client.RpcClientOptions
): client.Rpc<S, never, never> => {
  const errorSchemas = "error" in schema
    ? [RpcError, schema.error, ...serviceErrors]
    : [RpcError, ...serviceErrors]
  const parseError = codec.decode(
    schemaInternal.schemasToUnion(errorSchemas)
  )
  const parseOutput = "output" in schema ? codec.decode(schema.output) : (_: any) => Effect.unit

  if ("input" in schema) {
    const encodeInput = codec.encode(schema.input as Schema.Schema<any>)

    return ((input: any) => {
      const hash = resolverInternal.requestHash(method, input, spanPrefix)
      return Effect.useSpan(`${spanPrefix}.${method}`, (span) =>
        pipe(
          encodeInput(input),
          Effect.flatMap((input) =>
            Effect.request(
              resolverInternal.RpcRequest({
                payload: {
                  _tag: method,
                  input,
                  spanName: span.name,
                  spanId: span.spanId,
                  traceId: span.traceId
                },
                hash,
                schema
              }),
              resolver
            )
          ),
          Effect.flatMap(parseOutput),
          Effect.catchAll((e) => Effect.flatMap(parseError(e), Effect.fail))
        ))
    }) as any
  }

  const hash = resolverInternal.requestHash(method, undefined, spanPrefix)

  return Effect.useSpan(`${spanPrefix}.${method}`, (span) =>
    pipe(
      Effect.request(
        resolverInternal.RpcRequest({
          payload: {
            _tag: method,
            spanName: span.name,
            spanId: span.spanId,
            traceId: span.traceId
          },
          hash,
          schema
        }),
        resolver
      ),
      Effect.flatMap(parseOutput),
      Effect.catchAll((e) => Effect.flatMap(parseError(e), Effect.fail))
    )) as any
}