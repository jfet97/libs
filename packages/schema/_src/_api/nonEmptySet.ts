// tracing: off

import type { NonEmptySet } from "@effect-ts-app/core/NonEmptySet"
import type * as Eq from "@effect-ts/core/Equal"
import { pipe } from "@effect-ts/core/Function"
import type * as Ord from "@effect-ts/core/Ord"

import * as MO from "../custom.js"
import { minSize } from "./length.js"
import { set } from "./set.js"

export function nonEmptySet<ParsedShape, ConstructorInput, Encoded, Api>(
  self: MO.Schema<unknown, ParsedShape, ConstructorInput, Encoded, Api>,
  ord: Ord.Ord<ParsedShape>,
  eq?: Eq.Equal<ParsedShape>
) {
  return pipe(set(self, ord, eq), minSize<NonEmptySet<ParsedShape>>(1), MO.withDefaults)
}
