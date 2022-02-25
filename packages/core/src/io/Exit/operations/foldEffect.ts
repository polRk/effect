import type { Cause } from "../../Cause"
import type { Effect } from "../../Effect"
import type { Exit } from "../definition"

/**
 * Sequentially zips the this result with the specified result or else returns
 * the failed `Cause<E>`.
 *
 * @tsplus fluent ets/Exit foldEffect
 */
export function foldEffect_<E, A, R1, E1, A1, R2, E2, A2>(
  self: Exit<E, A>,
  failed: (cause: Cause<E>) => Effect<R1, E1, A1>,
  completed: (a: A) => Effect<R2, E2, A2>,
  __tsplusTrace?: string
): Effect<R1 & R2, E1 | E2, A1 | A2> {
  switch (self._tag) {
    case "Failure":
      return failed(self.cause)
    case "Success":
      return completed(self.value)
  }
}

/**
 * Sequentially zips the this result with the specified result or else returns
 * the failed `Cause<E>`.
 *
 * @ets_data_first foldEffect_
 */
export function foldEffect<A, E, R1, E1, A1, R2, E2, A2>(
  failed: (cause: Cause<E>) => Effect<R1, E1, A1>,
  completed: (a: A) => Effect<R2, E2, A2>,
  __tsplusTrace?: string
) {
  return (self: Exit<E, A>): Effect<R1 & R2, E1 | E2, A1 | A2> =>
    self.foldEffect(failed, completed)
}
