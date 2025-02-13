/* eslint-disable @typescript-eslint/no-explicit-any */
// tracing: off
import {
  arrayIdentifier,
  boolIdentifier,
  chunkIdentifier,
  dateIdentifier,
  eitherIdentifier,
  EmailFromStringIdentifier,
  EmailIdentifier,
  fromChunkIdentifier,
  fromPropertiesIdentifier,
  fromStringIdentifier,
  hasContinuation,
  intersectIdentifier,
  intFromNumberIdentifier,
  intIdentifier,
  literalIdentifier,
  maxIdentifier,
  maxLengthIdentifier,
  metaIdentifier,
  minIdentifier,
  minLengthIdentifier,
  nonEmptyStringFromStringIdentifier,
  nonEmptyStringIdentifier,
  nullableIdentifier,
  numberIdentifier,
  optionFromNullIdentifier,
  PhoneNumberFromStringIdentifier,
  PhoneNumberIdentifier,
  propertiesIdentifier,
  rangeIdentifier,
  SchemaAnnotated,
  SchemaContinuationSymbol,
  setIdentifier,
  stringIdentifier,
  unionIdentifier,
  unknownIdentifier,
  UUIDFromStringIdentifier
} from "@effect-app/schema"
import * as MO from "@effect-app/schema"

import type { JSONSchema } from "../atlas-plutus.js"
import {
  AllOfSchema,
  ArraySchema,
  BooleanSchema,
  EnumSchema,
  NumberSchema,
  ObjectSchema,
  OneOfSchema,
  referenced,
  StringSchema
} from "../atlas-plutus.js"

export type Gen = Effect<never, never, JSONSchema>

export const interpreters: ((schema: MO.SchemaAny) => Option<Gen>)[] = [
  Option.partial((_miss) => (schema: MO.SchemaAny): Gen => {
    // if (schema instanceof MO.SchemaOpenApi) {
    //   const cfg = schema.jsonSchema()
    //   return processId(schema, cfg)
    // }

    // if (schema instanceof MO.SchemaRecur) {
    //   if (interpreterCache.has(schema)) {
    //     return interpreterCache.get(schema)
    //   }
    //   const parser = () => {
    //     if (interpretedCache.has(schema)) {
    //       return interpretedCache.get(schema)
    //     }
    //     const e = for_(schema.self(schema))()
    //     interpretedCache.set(schema, e)
    //     return e
    //   }
    //   interpreterCache.set(schema, parser)
    //   return parser
    // }

    return processId(schema)

    // return miss()
  })
]

// TODO: Cache
type Meta = MO.Meta & {
  title?: string
  noRef?: boolean
  openapiRef?: string
  minLength?: number
  maxLength?: number
}

function processId(schema: MO.SchemaAny, meta: Meta = {}): any {
  if (!schema) {
    throw new Error("schema undefined")
  }
  if ("lazy" in schema) {
    // TODO: Support recursive structures
    return Effect(new ObjectSchema({}))
  }
  return Effect.gen(function*($) {
    if (schema instanceof MO.SchemaRefinement) {
      return yield* $(processId(schema.self, meta))
    }
    //   if (schema instanceof MO.SchemaPipe) {
    //     return processId(schema.that, meta)
    //   }
    //   if (schema instanceof MO.SchemaConstructor) {
    //     return processId(schema.self, meta)
    //   }

    // console.log("$$$", schema.annotation)

    // if (schema instanceof MO.SchemaOpenApi) {
    //   const cfg = schema.jsonSchema()
    //   meta = { ...meta, ...cfg }
    // }
    if (schema instanceof MO.SchemaNamed) {
      meta = { title: schema.name, ...meta }
    }

    if (schema instanceof SchemaAnnotated) {
      // TODO: proper narrow the types
      const schemaMeta = schema.meta
      switch (schema.annotation) {
        case MO.reqId: {
          meta = { noRef: true, ...meta }
          break
        }
        case metaIdentifier: {
          meta = { ...schemaMeta, ...meta }
          break
        }
        case intersectIdentifier: {
          const { noRef, openapiRef, ...rest } = meta
          const ref = openapiRef || rest.title
          const s = new AllOfSchema({
            ...rest,
            allOf: [
              yield* $(processId(schemaMeta.self)) as any,
              yield* $(processId(schemaMeta.that)) as any
            ]
          })
          // If this is a named intersection, we assume that merging the intersected types
          // is desired. Lets make it configurable if someone needs it :)
          const obj = ref ? merge(s) : s

          return yield* $(
            noRef
              ? Effect(obj)
              : referenced({ openapiRef: ref })(Effect(obj))
          )
        }
        case unionIdentifier: {
          return new OneOfSchema({
            ...meta,
            oneOf: yield* $(
              Object
                .keys(schemaMeta.props)
                .forEachEffect(
                  (x) => processId(schemaMeta.props[x])
                )
            ) as any,
            discriminator: (schemaMeta.tag as Option<any>)
              .map((_: any) => ({
                propertyName: _.key // TODO
              }))
              .value
          })
        }
        case fromStringIdentifier:
        case stringIdentifier:
          return new StringSchema(meta)
        case minLengthIdentifier:
          meta = { minLength: schemaMeta.minLength, ...meta }
          break
        case maxLengthIdentifier:
          meta = { maxLength: schemaMeta.maxLength, ...meta }
          break
        case nonEmptyStringFromStringIdentifier:
        case nonEmptyStringIdentifier:
          return new StringSchema({ minLength: 1, ...meta })

        case EmailFromStringIdentifier:
        case EmailIdentifier:
          return new StringSchema({ format: "email", ...meta })
        case PhoneNumberFromStringIdentifier:
        case PhoneNumberIdentifier:
          return new StringSchema({ format: "phone" as any, ...meta })

        case literalIdentifier:
          // FUTURE OAS 3.1.0: literals.length === 1 ? { const: literals[0 ]} : { enum: literals } ...
          return new EnumSchema({ enum: schemaMeta.literals, ...meta })

        case UUIDFromStringIdentifier:
          return new StringSchema({ format: "uuid", ...meta })
        case dateIdentifier:
          return new StringSchema({ format: "date-time", ...meta })
        case numberIdentifier:
        case intIdentifier:
        case intFromNumberIdentifier:
          return new NumberSchema(meta)
        case minIdentifier:
          return new NumberSchema({
            minimum: schemaMeta.minimum,
            exclusiveMinimum: schemaMeta.minimumExclusive,
            ...meta
          })
        case maxIdentifier:
          return new NumberSchema({
            maximum: schemaMeta.maximum,
            exclusiveMaximum: schemaMeta.maximumExclusive,
            ...meta
          })
        case rangeIdentifier:
          return new NumberSchema({
            minimum: schemaMeta.minimum,
            exclusiveMinimum: schemaMeta.minimumExclusive,
            maximum: schemaMeta.maximum,
            exclusiveMaximum: schemaMeta.maximumExclusive,
            ...meta
          })
        case boolIdentifier:
          return new BooleanSchema(meta)
        case optionFromNullIdentifier:
          return {
            ...((yield* $(processId(schemaMeta.self, meta))) as any),
            nullable: true
          }
        case nullableIdentifier:
          return {
            ...((yield* $(processId(schemaMeta.self, meta))) as any),
            nullable: true
          }
        case arrayIdentifier:
          return new ArraySchema({
            items: yield* $(processId(schemaMeta.self, meta)) as any
          })
        case setIdentifier:
          return new ArraySchema({
            items: yield* $(processId(schemaMeta.self, meta)) as any,
            uniqueItems: true
          })
        case chunkIdentifier:
          return new ArraySchema({
            items: yield* $(processId(schemaMeta.self, meta)) as any
          })
        case fromChunkIdentifier:
          return new ArraySchema({
            items: yield* $(processId(schemaMeta.self, meta)) as any
          })
        case eitherIdentifier: {
          return new OneOfSchema({
            ...meta,
            oneOf: (yield* $(
              [schemaMeta.left, schemaMeta.right]
                .forEachEffect((x) => processId(x))
            ))
              .map((v, i) => ({
                properties: {
                  _tag: { enum: [i === 0 ? "Left" : "Right"] },
                  [i === 0 ? "left" : "right"]: v
                },
                required: ["_tag", i === 0 ? "left" : "right"],
                type: "object"
              }))
              .toArray as any,
            discriminator: { propertyName: "_tag" }
          })
        }
        case unknownIdentifier: {
          const { noRef, openapiRef, ...rest } = meta
          const obj = new ObjectSchema({
            ...rest,
            properties: {},
            required: undefined
          })
          return yield* $(
            noRef
              ? Effect(obj)
              : referenced({ openapiRef: openapiRef || rest.title })(
                Effect(obj)
              )
          )
        }
        case fromPropertiesIdentifier:
        case propertiesIdentifier: {
          const properties: Record<string, any> = {}
          const required: string[] = []
          for (const k in schemaMeta.props) {
            const p: MO.AnyProperty = schemaMeta.props[k]
            properties[k] = yield* $(processId(p["_schema"]))
            if (p["_optional"] === "required") {
              required.push(k)
            }
          }
          const { noRef, openapiRef, ...rest } = meta
          const obj = new ObjectSchema({
            ...rest,
            properties,
            required: required.length ? required : undefined
          })
          return yield* $(
            noRef
              ? Effect(obj)
              : referenced({ openapiRef: openapiRef || rest.title })(
                Effect(obj)
              )
          )
        }
      }
    }

    if (hasContinuation(schema)) {
      return yield* $(processId(schema[SchemaContinuationSymbol], meta))
    }
  })
}

function merge(schema: any) {
  let b = schema as ObjectSchema // TODO: allOfSchema.
  function recurseAllOf(allOf: AllOfSchema["allOf"], nb: any) {
    allOf.forEach((x: any) => {
      const a = x as AllOfSchema
      if (a.allOf) {
        recurseAllOf(a.allOf, nb)
      } else {
        nb.required = (nb.required ?? []).concat(x.required ?? [])
        if (nb.required.length === 0) {
          nb.required = undefined
        }
        nb.properties = { ...nb.properties, ...x.properties }
      }
    })
  }
  const a = b as any as AllOfSchema
  if (a.allOf) {
    const [{ description: ____, nullable: ___, title: __, type: _____, ...first }] = a.allOf as any
    const nb = {
      title: a.title,
      type: "object",
      description: a.description,
      summary: a.summary,
      nullable: a.nullable,
      ...first
    }
    recurseAllOf(a.allOf.slice(1), nb)
    b = nb
  }
  return b
}

const cache = new WeakMap()

function for_<ParserInput, ParsedShape, ConstructorInput, Encoded, Api>(
  schema: MO.Schema<ParserInput, ParsedShape, ConstructorInput, Encoded, Api>
): Gen {
  if (cache.has(schema)) {
    return cache.get(schema)
  }
  for (const interpreter of interpreters) {
    const _ = interpreter(schema)
    if (_._tag === "Some") {
      cache.set(schema, _.value)
      return _.value
    }
  }
  if (hasContinuation(schema)) {
    const arb = for_(schema[SchemaContinuationSymbol])
    cache.set(schema, arb)
    return arb
  }
  throw new Error(`Missing openapi integration for: ${schema.constructor}`)
}

export { for_ as for }
