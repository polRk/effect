import { Effect } from "../../Effect"
import type { Managed } from "../definition"

/**
 * Use the resource until interruption. Useful for resources that you want
 * to acquire and use as long as the application is running, like a
 * HTTP server.
 *
 * @tsplus fluent ets/Managed useForever
 */
export function useForever<R, E, A>(self: Managed<R, E, A>, __tsplusTrace?: string) {
  return self.use(() => Effect.never)
}
