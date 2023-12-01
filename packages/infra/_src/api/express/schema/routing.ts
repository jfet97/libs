/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as S from "@effect-app/schema"
import type { Methods } from "@effect-app/schema"

import type { JSONSchema, ParameterLocation, SubSchema } from "@effect-app/infra-adapters/Openapi/atlas-plutus"
import { isObjectSchema } from "@effect-app/infra-adapters/Openapi/atlas-plutus"
import * as OpenApi from "@effect-app/infra-adapters/Openapi/index"

export type Request<
  M,
  PathA,
  CookieA,
  QueryA,
  BodyA,
  HeaderA,
  ReqA extends PathA & QueryA & BodyA
> = S.ReqResSchemed<unknown, ReqA> & {
  method: Methods.Rest
  path: string
  Cookie?: S.ReqRes<Record<string, string>, CookieA>
  Path?: S.ReqRes<Record<string, string>, PathA>
  Body?: S.ReqRes<unknown, BodyA>
  Query?: S.ReqRes<Record<string, string>, QueryA>
  Headers?: S.ReqRes<Record<string, string>, HeaderA>
  Tag: Tag<M, M>
}

export interface RouteRequestHandler<
  M,
  PathA,
  CookieA,
  QueryA,
  BodyA,
  HeaderA,
  ReqA extends PathA & QueryA & BodyA,
  ResA
> {
  Request: Request<M, PathA, CookieA, QueryA, BodyA, HeaderA, ReqA>
  Response?: S.ReqRes<unknown, ResA> | S.ReqResSchemed<unknown, ResA>
  ResponseOpenApi?: any
}

export function asRouteDescriptionAny<R extends RouteDescriptorAny>(i: R) {
  return i as RouteDescriptorAny
}

export function arrAsRouteDescriptionAny<R extends RouteDescriptorAny>(
  arr: ReadonlyArray<R>
) {
  return arr.map(asRouteDescriptionAny)
}

export interface RouteDescriptor<
  M,
  PathA,
  CookieA,
  QueryA,
  BodyA,
  HeaderA,
  ReqA extends PathA & QueryA & BodyA,
  ResA,
  METHOD extends Methods.Rest = Methods.Rest
> {
  _tag: "Schema"
  path: string
  method: METHOD
  handler: RouteRequestHandler<M, PathA, CookieA, QueryA, BodyA, HeaderA, ReqA, ResA>
  info?: {
    tags: ReadonlyArray<string>
  }
}

export type RouteDescriptorAny = RouteDescriptor<
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any
>

export function makeRouteDescriptor<
  M,
  PathA,
  CookieA,
  QueryA,
  BodyA,
  HeaderA,
  ReqA extends PathA & QueryA & BodyA,
  ResA = void,
  METHOD extends Methods.Rest = Methods.Rest
>(
  path: string,
  method: METHOD,
  handler: RouteRequestHandler<
    M,
    PathA,
    CookieA,
    QueryA,
    BodyA,
    HeaderA,
    ReqA,
    ResA
  >
): RouteDescriptor<
  M,
  PathA,
  CookieA,
  QueryA,
  BodyA,
  HeaderA,
  ReqA,
  ResA,
  METHOD
> {
  return { path, handler, method, _tag: "Schema" }
}

export function makeFromSchema<ResA>(
  e: RouteDescriptor<any, any, any, any, any, any, ResA, any>
) {
  const jsonSchema_ = OpenApi.for
  const jsonSchema = <E, A>(r: S.ReqRes<E, A>) => jsonSchema_(r)
  const { Request: Req, Response: Res_, ResponseOpenApi } = e.handler
  const r = ResponseOpenApi ?? Res_
  const Res = r ? S.extractSchema(r) : S.Void
  // TODO EffectOption.fromNullable(Req.Headers).flatMapOpt(jsonSchema)
  // TODO: use the path vs body etc serialisation also in the Client.
  const makeReqQuerySchema = Effect(Option.fromNullable(Req.Query)).flatMap((_) =>
    _.match({
      onNone: () => Effect(Option.none),
      onSome: (_) => jsonSchema(_).map(Option.some)
    })
  )
  const makeReqHeadersSchema = Effect(Option.fromNullable(Req.Headers)).flatMap((_) =>
    _.match({
      onNone: () => Effect(Option.none),
      onSome: (_) => jsonSchema(_).map(Option.some)
    })
  )
  const makeReqCookieSchema = Effect(Option.fromNullable(Req.Cookie)).flatMap((_) =>
    _.match({
      onNone: () => Effect(Option.none),
      onSome: (_) => jsonSchema(_).map(Option.some)
    })
  )
  const makeReqPathSchema = Effect(Option.fromNullable(Req.Path)).flatMap((_) =>
    _.match({
      onNone: () => Effect(Option.none),
      onSome: (_) => jsonSchema(_).map(Option.some)
    })
  )
  const makeReqBodySchema = Effect(Option.fromNullable(Req.Body)).flatMap((_) =>
    _.match({
      onNone: () => Effect(Option.none),
      onSome: (_) => jsonSchema(_).map(Option.some)
    })
  )
  // const makeReqSchema = schema(Req)

  const makeResSchema = jsonSchema_(Res as any)

  function makeParameters(inn: ParameterLocation) {
    return (a: Option<JSONSchema | SubSchema>) => {
      return a
        .flatMap((o) => (isObjectSchema(o) ? Option(o) : Option.none))
        .map((x) => {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          return Object.keys(x.properties!).map((p) => {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const schema = x.properties![p]
            const required = Boolean(x.required?.includes(p))
            return { name: p, in: inn, required, schema }
          })
        })
        .getOrElse(() => [])
    }
  }

  return Effect
    .all({
      req: jsonSchema(Req.Model),
      reqQuery: makeReqQuerySchema,
      reqHeaders: makeReqHeadersSchema,
      reqBody: makeReqBodySchema,
      reqPath: makeReqPathSchema,
      reqCookie: makeReqCookieSchema,
      res: makeResSchema
    })
    .map((_) => {
      // console.log("$$$ REQ", _.req)
      const isEmpty = !e.handler.Response || e.handler.Response === S.Void
      return {
        path: e.path,
        method: e.method.toLowerCase(),
        tags: e.info?.tags,
        description: _.req?.description,
        summary: _.req?.summary,
        operationId: _.req?.title,
        parameters: [
          ...makeParameters("path")(_.reqPath),
          ...makeParameters("query")(_.reqQuery),
          ...makeParameters("header")(_.reqHeaders),
          ...makeParameters("cookie")(_.reqCookie)
        ],
        requestBody: _
          .reqBody
          .map((schema) => ({
            content: { "application/json": { schema } }
          }))
          .value,
        responses: [
          isEmpty
            ? new Response(204, { description: "Empty" })
            : new Response(200, {
              description: "OK",
              content: { "application/json": { schema: _.res } }
            }),
          new Response(400, { description: "ValidationError" })
        ]
          .concat(
            e.path.includes(":") && isEmpty
              ? [new Response(404, { description: "NotFoundError" })]
              : []
          )
      }
    })
}

class Response {
  constructor(
    public readonly statusCode: number,
    public readonly type: any // string | JSONSchema | SubSchema
  ) {}
}
