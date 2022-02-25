import type { Chunk } from "../../../collection/immutable/Chunk"
import type { LazyArg } from "../../../data/Function"
import type { Option } from "../../../data/Option"
import { Effect } from "../definition"

/**
 * Evaluate each effect in the structure from left to right, collecting the
 * the successful values and discarding the empty cases. For a parallel version, see `collectPar`.
 *
 * @tsplus static ets/EffectOps collect
 */
export function collect<A, R, E, B>(
  as: LazyArg<Iterable<A>>,
  f: (a: A) => Effect<R, Option<E>, B>,
  __tsplusTrace?: string
): Effect<R, E, Chunk<B>> {
  return Effect.forEach(as, (a) => f(a).unsome()).map((chunk) => chunk.compact())
}
