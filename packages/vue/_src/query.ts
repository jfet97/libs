/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import type { QueryObserverOptions } from "@tanstack/vue-query"
import { useQuery } from "@tanstack/vue-query"
import { Effect, Runtime } from "effect-app"
import { Done, Initial, Loading, Refreshing } from "effect-app/client"
import type { ApiConfig, FetchResponse, QueryResult } from "effect-app/client"
import { computed, ref, type WatchSource } from "vue"
import { run } from "./internal.js"

// TODO: options
// declare function useQuery<TQueryFnData = unknown, TError = DefaultError, TData = TQueryFnData, TQueryKey extends QueryKey = QueryKey>(options: UndefinedInitialQueryOptions<TQueryFnData, TError, TData, TQueryKey>, queryClient?: QueryClient): UseQueryReturnType<TData, TError>;
// declare function useQuery<TQueryFnData = unknown, TError = DefaultError, TData = TQueryFnData, TQueryKey extends QueryKey = QueryKey>(options: DefinedInitialQueryOptions<TQueryFnData, TError, TData, TQueryKey>, queryClient?: QueryClient): UseQueryDefinedReturnType<TData, TError>;
// declare function useQuery<TQueryFnData = unknown, TError = DefaultError, TData = TQueryFnData, TQueryKey extends QueryKey = QueryKey>(options: UseQueryOptions<TQueryFnData, TError, TData, TQueryFnData, TQueryKey>, queryClient?: QueryClient): UseQueryReturnType<TData, TError>;

export const useSafeQuery = <I, A, E>(
  q:
    | {
      handler: (
        req: I
      ) => Effect<
        FetchResponse<A>,
        E,
        ApiConfig | HttpClient.Default
      >
      mapPath: (req: I) => string
    }
    | {
      handler: Effect<
        FetchResponse<A>,
        E,
        ApiConfig | HttpClient.Default
      >
      mapPath: string
    },
  arg?: I | WatchSource<I>,
  options: QueryObserverOptions<any, any, any> = {} // TODO
) => {
  const arr = arg
  const req: { value: I } = !arg
    ? undefined
    : typeof arr === "function"
    ? ({
      get value() {
        return (arr as any)()
      }
    } as any)
    : ref(arg)
  const r = useQuery(
    Effect.isEffect(q.handler)
      ? {
        ...options,
        queryKey: [computed(() => q.mapPath)],
        queryFn: () =>
          run
            .value(q.handler)
            .then((_) => (_ as any).body)
            .catch((_) => {
              if (!Runtime.isFiberFailure(_)) throw _
              const cause = _[Runtime.FiberFailureCauseId]
              throw Cause.squash(cause)
            })
      }
      : {
        ...options,
        queryKey: [computed(() => (q.mapPath as any)(req.value))],
        queryFn: () =>
          run
            .value(q.handler(req.value))
            .then((_) => (_ as any).body)
            .catch((_) => {
              if (!Runtime.isFiberFailure(_)) throw _
              const cause = _[Runtime.FiberFailureCauseId]
              throw Cause.squash(cause)
            })
      }
  )

  function swrToQuery<E, A>(r: {
    error: E | undefined
    data: A | undefined
    isValidating: boolean
  }): QueryResult<E, A> {
    if (r.error) {
      return r.isValidating
        ? Refreshing.fail<E, A>(r.error, r.data)
        : Done.fail<E, A>(r.error, r.data)
    }
    if (r.data !== undefined) {
      return r.isValidating
        ? Refreshing.succeed<A, E>(r.data)
        : Done.succeed<A, E>(r.data)
    }

    return r.isValidating ? new Loading() : new Initial()
  }

  const result = computed(() =>
    swrToQuery({
      error: r.error.value,
      data: r.data.value,
      isValidating: r.isFetching.value
    })
  )
  const latestSuccess = computed(() => {
    const value = result.value
    return value.isSuccess()
      ? value.current.isRight()
        ? value.current.right
        : value.previous.isSome()
        ? value.previous.value
        : undefined
      : undefined
  })
  return [result, latestSuccess, r.refetch] as const
}
