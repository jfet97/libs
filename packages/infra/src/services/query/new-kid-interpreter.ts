/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { toNonEmptyArray } from "@effect-app/core/Array"
import { Match, Option, pipe, S } from "effect-app"
import { dropUndefinedT } from "effect-app/utils"
import type { FieldValues } from "../../filter/types.js"
import type { FieldPath } from "../../filter/types/path/eager.js"
import { make, type Q, type QAll } from "../query.js"
import type { FilterResult, QueryBuilder } from "../Store/filterApi/query.js"

type Result<TFieldValues extends FieldValues, A = TFieldValues, R = never> = {
  filter: FilterResult[]
  schema: S.Schema<A, TFieldValues, R> | undefined
  limit: number | undefined
  skip: number | undefined
  order: { key: FieldPath<TFieldValues>; direction: "ASC" | "DESC" }[]
}

const interpret = <TFieldValues extends FieldValues, A = TFieldValues, R = never>(_: QAll<TFieldValues, A, R>) => {
  const a = _ as Q<TFieldValues>

  const data: Result<TFieldValues, any, any> = {
    filter: [],
    schema: undefined,
    limit: undefined,
    skip: undefined,
    order: []
  }

  const upd = (
    v: Result<TFieldValues, any, any>
  ) => {
    data.filter.push(...v.filter)
    data.order.push(...v.order)
    data.limit = v.limit
    data.skip = v.skip
    data.schema = v.schema
  }

  pipe(
    a,
    Match.valueTags({
      value: () => {
        // data.filter.push(value)
      },
      where: ({ current, operation }) => {
        upd(interpret(current))
        data.filter.push(
          {
            t: "where",
            path: operation[0],
            op: operation.length === 2 ? "eq" : operation[1],
            value: operation.length === 2 ? operation[1] : operation[2]
          }
        )
      },
      and: ({ current, operation }) => {
        upd(interpret(current))
        if (typeof operation === "function") {
          data.filter.push(
            { t: "and-scope", result: interpret(operation(make())).filter }
          )
        } else {
          data.filter.push(
            {
              t: "and",
              path: operation[0],
              op: operation.length === 2 ? "eq" : operation[1],
              value: operation.length === 2 ? operation[1] : operation[2]
            }
          )
        }
      },
      or: ({ current, operation }) => {
        upd(interpret(current))
        if (typeof operation === "function") {
          data.filter.push(
            { t: "or-scope", result: interpret(operation(make())).filter }
          )
        } else {
          data.filter.push(
            {
              t: "or",
              path: operation[0],
              op: operation.length === 2 ? "eq" : operation[1],
              value: operation.length === 2 ? operation[1] : operation[2]
            }
          )
        }
      },
      order: ({ current, direction, field }) => {
        upd(interpret(current))
        data.order.push({ key: field, direction })
      },
      page: (v) => {
        upd(interpret(v.current))
        data.limit = v.limit
        data.skip = v.skip
      },
      project: (v) => {
        upd(interpret(v.current))
        data.schema = v.schema
      }
    })
  )

  return data
}

export const toFilter = <
  TFieldValues extends FieldValues,
  A,
  R
>(
  q: QAll<TFieldValues, A, R>
) => {
  // TODO: Native interpreter for each db adapter, instead of the intermediate "new-kid" format
  const a = interpret(q)
  const schema = a.schema
  let select: (keyof TFieldValues)[] = []
  if (schema) {
    let t = schema.ast
    if (S.AST.isTransform(t)) {
      t = t.from
    }
    if (S.AST.isTypeLiteral(t)) {
      select = t.propertySignatures.map((_) => _.name) as any
    }
  }
  return dropUndefinedT({
    limit: a.limit,
    skip: a.skip,
    select: Option.getOrUndefined(toNonEmptyArray(select)),
    schema,
    order: Option.getOrUndefined(toNonEmptyArray(a.order)),
    filter: a.filter.length
      ? {
        type: "new-kid" as const,
        build: () => a.filter
      } as QueryBuilder<any>
      : undefined
  })
}
