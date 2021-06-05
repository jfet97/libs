/* eslint-disable @typescript-eslint/ban-types */
import { Tagged } from "@effect-ts/core/Case"
import * as E from "@effect-ts/core/Either"
import { pipe } from "@effect-ts/core/Function"
import { matchTag } from "@effect-ts/core/Utils"
import { Exit } from "@effect-ts/system/Exit"
import * as T from "@effect-ts-app/core/Effect"
import { useCallback, useEffect, useRef, useState } from "react"

export { matchTag } from "@effect-ts/core/Utils"

export class Initial extends Tagged("Initial")<{}> {}

export class Loading extends Tagged("Loading")<{}> {}

export class Done<E, A> extends Tagged("Done")<{ readonly current: E.Either<E, A> }> {}

export class Refreshing<E, A> extends Tagged("Refreshing")<{
  readonly current: E.Either<E, A>
}> {}

export type QueryResult<E, A> = Initial | Loading | Refreshing<E, A> | Done<E, A>

export type ResultTuple<Result> = readonly [result: Result, refresh: () => void]
export type QueryResultTuple<E, A> = ResultTuple<QueryResult<E, A>>

const fail = <E>(err: E) => new Done({ current: E.left(err) })
const succeed = <A>(a: A) => new Done({ current: E.right(a) })

export function makeUseQuery<R>(useServiceContext: () => ServiceContext<R>) {
  /**
   * Takes an Effect and turns it into a QueryResult and refresh function.
   *
   * NOTE:
   * Pass a stable Effect, otherwise will request at every render.
   * E.g memoize for a parameterised effect:
   * ```
   *  const findSomething = useMemo(() => Something.find(id), [id])
   *  const [result] = useQuery(findSomething)
   * ```
   */
  return <E, A>(self: T.Effect<R, E, A>): QueryResultTuple<E, A> => {
    const { runWithErrorLog } = useServiceContext()
    const resultInternal = useRef<QueryResult<E, A>>(new Initial())
    const [result, setResult] = useState<QueryResult<E, A>>(resultInternal.current)
    const [signal, setSignal] = useState(() => Symbol())
    const refresh = useCallback(() => setSignal(Symbol()), [])

    useEffect(() => {
      const loadingResult =
        resultInternal.current._tag === "Initial" ||
        resultInternal.current._tag === "Loading"
          ? new Loading()
          : new Refreshing({ current: resultInternal.current.current })
      setResult((resultInternal.current = loadingResult))

      return runWithErrorLog(pipe(queryResult(self), T.map(setResult)))
    }, [self, runWithErrorLog, signal])

    return [result, refresh] as const
  }
}
export function queryResult<R, E, A>(
  self: T.Effect<R, E, A>
): T.Effect<R, never, QueryResult<E, A>> {
  return self["|>"](T.fold(fail, succeed))
}

export function matchQuery<E, A, Result>(_: {
  Initial: () => Result
  Loading: () => Result
  Error: (e: E, isRefreshing: boolean) => Result
  Success: (a: A, isRefreshing: boolean) => Result
}) {
  return (r: QueryResult<E, A>) =>
    r["|>"](
      matchTag({
        Initial: _.Initial,
        Loading: _.Loading,
        Refreshing: (r) =>
          r.current["|>"](
            E.fold(
              (e) => _.Error(e, true),
              (a) => _.Success(a, true)
            )
          ),
        Done: (r) =>
          r.current["|>"](
            E.fold(
              (e) => _.Error(e, false),
              (a) => _.Success(a, false)
            )
          ),
      })
    )
}

export interface ServiceContext<R> {
  readonly provide: <E, A>(self: T.Effect<R, E, A>) => T.Effect<unknown, E, A>
  readonly runWithErrorLog: <E, A>(self: T.Effect<R, E, A>) => () => void
  readonly runPromise: <E, A>(self: T.Effect<R, E, A>) => Promise<Exit<E, A>>
}
