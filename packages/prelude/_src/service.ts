/**
 * We're doing the long way around here with assignTag, TagBase & TagBaseTagged,
 * because there's a typescript compiler issue where it will complain about Equal.symbol, and Hash.symbol not being accessible.
 * https://github.com/microsoft/TypeScript/issues/52644
 */

import type { TagTypeId as TagTypeIdOriginal } from "@effect/data/Context"

export const ServiceTag = Symbol()
export type ServiceTag = typeof ServiceTag

export abstract class PhantomTypeParameter<Identifier extends keyof any, InstantiatedType> {
  protected abstract readonly [ServiceTag]: {
    readonly [NameP in Identifier]: (_: InstantiatedType) => InstantiatedType
  }
}

/**
 * @tsplus type ServiceTagged
 */
export abstract class ServiceTagged<ServiceKey> extends PhantomTypeParameter<string, ServiceKey> {}

/**
 * @tsplus static ServiceTagged make
 */
export function makeService<T extends ServiceTagged<any>>(_: Omit<T, ServiceTag>) {
  return _ as T
}

/**
 * @tsplus fluent effect/data/Context/Tag make
 */
export function make<T extends ServiceTagged<any>, I = T>(_: Tag<I, T>, t: Omit<T, ServiceTag>) {
  return t as T
}

export const TagTypeId: TagTypeIdOriginal = Symbol.for("@effect/data/Context/Tag") as unknown as TagTypeIdOriginal
export type TagTypeId = typeof TagTypeId

export function assignTag<Id, Service = Id>(key?: unknown) {
  return <S extends object>(cls: S) => {
    const tag = Tag<Id, Service>(key)
    return Object.assign(cls, tag)
  }
}
export function TagClass<Id, Service = Id>(key?: unknown) {
  abstract class TagClass {
    static flatMap<R1, E1, B>(f: (a: Service) => Effect<R1, E1, B>): Effect<Id | R1, E1, B> {
      return Effect.flatMap(this as unknown as Tag<Id, Service>, f)
    }
    static map<B>(f: (a: Service) => B): Effect<Id, never, B> {
      return Effect.map(this as unknown as Tag<Id, Service>, f)
    }
    static makeLayer(svc: Service) {
      return Layer.succeed(this as unknown as Tag<Id, Service>, svc)
    }
  }

  return assignTag<Id, Service>(key)(TagClass)
}

/** @deprecated use `Id` of TagClass for unique id */
export function ServiceTaggedClass<Id, Service = Id>() {
  return <Key extends PropertyKey>(_: Key) => {
    abstract class ServiceTaggedClassC {
      static make(t: Omit<Service, Key>) {
        return t as Service
      }
      static flatMap<R1, E1, B>(f: (a: Service) => Effect<R1, E1, B>): Effect<Id | R1, E1, B> {
        return Effect.flatMap(this as unknown as Tag<Id, Service>, f)
      }
      static map<B>(f: (a: Service) => B): Effect<Id, never, B> {
        return Effect.map(this as unknown as Tag<Id, Service>, f)
      }
      static makeLayer(svc: Service) {
        return Layer.succeed(this as unknown as Tag<Id, Service>, svc)
      }
    }

    return assignTag<Id, Service>()(ServiceTaggedClassC)
  }
}
