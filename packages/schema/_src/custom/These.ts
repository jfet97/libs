// tracing: off

export const _E: unique symbol = Symbol()
export const _A: unique symbol = Symbol()

/**
 * @tsplus type ets/Schema/These
 * @tsplus companion ets/Schema/TheseOps
 */
export class These<E, A> {
  readonly [_E]!: () => E
  readonly [_A]!: () => A
  constructor(readonly effect: Either<E, readonly [A, Option<E>]>) {}
}

export function succeed<A>(a: A) {
  return new These(Either(tuple(a, Option.none)))
}

export function warn<E, A>(a: A, e: E) {
  return new These(Either(tuple(a, Option(e))))
}

export function fail<E>(e: E) {
  return new These<E, never>(Either.left(e))
}

export function foldM_<E, A, E1, A1, E2, A2, E3, A3>(
  self: These<E, A>,
  onSuccess: (a: A) => These<E1, A1>,
  onBoth: (a: A, e: E) => These<E2, A2>,
  onFail: (e: E) => These<E3, A3>
): These<E1 | E2 | E3, A1 | A2 | A3> {
  return new These(
    self.effect.match(
      (x): Either<E1 | E2 | E3, readonly [A1 | A2 | A3, Option<E1 | E2 | E3>]> => onFail(x).effect,
      ([result, warnings]) =>
        warnings._tag === "None"
          ? onSuccess(result).effect
          : onBoth(result, warnings.value).effect
    )
  )
}

export function foldM<E, A, E1, A1, E2, A2, E3, A3>(
  onSuccess: (a: A) => These<E1, A1>,
  onBoth: (a: A, e: E) => These<E2, A2>,
  onFail: (e: E) => These<E3, A3>
) {
  return (self: These<E, A>): These<E1 | E2 | E3, A1 | A2 | A3> => foldM_(self, onSuccess, onBoth, onFail)
}

export function map_<E, A0, A>(self: These<E, A0>, f: (a: A0) => A) {
  return foldM_(
    self,
    (a) => succeed(f(a)),
    (a, e) => warn(f(a), e),
    fail
  )
}

export function map<A0, A>(f: (a: A0) => A) {
  return <E>(self: These<E, A0>) => map_(self, f)
}

export function mapError_<E0, E, A>(self: These<E0, A>, f: (a: E0) => E): These<E, A> {
  return foldM_(
    self,
    (a) => succeed(a),
    (a, e) => warn(a, f(e)),
    (e) => fail(f(e))
  )
}

export function mapError<E0, E>(
  f: (a: E0) => E
): <A>(self: These<E0, A>) => These<E, A> {
  return (self) => mapError_(self, f)
}

export function chain_<E0, A0, E, A>(
  self: These<E0, A0>,
  f: (a: A0, w: Option<E0>) => These<E, A>
) {
  return foldM_(
    self,
    (a) => f(a, Option.none),
    (a, _) => f(a, Option(_)),
    fail
  )
}

export function chain<E0, A0, E, A>(f: (a: A0, w: Option<E0>) => These<E, A>) {
  return (self: These<E0, A0>) => chain_(self, f)
}

export function result<E, A>(self: These<E, A>): Either<E, readonly [A, Option<E>]> {
  return self.effect
}
