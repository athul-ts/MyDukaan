import { MINUTE_MS } from "./time.js";

export const STALE_AFTER_MS = 5 * MINUTE_MS;
/** max-age 30 plus stale-while-revalidate 120, so the browser can't return the same list. */
export const CACHE_LIFE_MS = 150 * 1000;

/**
 * There's no interval polling. A refetch happens only in these two cases, and at most once for a
 * list whose timers have all ended, so a cached response can't start a loop.
 *
 * Returns the delay in milliseconds before refetching, or null for no refetch.
 */
export function shouldRefetch({ event, now, lastFetchAt, alreadyRefetchedList }) {
  const age = now - lastFetchAt;
  if (event === "tabVisible") return age > STALE_AFTER_MS ? 0 : null;
  if (event === "allEnded" && !alreadyRefetchedList) return Math.max(0, CACHE_LIFE_MS - age);
  return null;
}
