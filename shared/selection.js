import { MINUTE_MS, toMs } from "./time.js";

const SPECIFICITY = { products: 0, collections: 1, all: 2 };

/** Longer than the longest cache life of 150 seconds, so a timer starting mid-cache still appears. */
export const LEAD_IN_MS = 5 * MINUTE_MS;
export const MAX_CANDIDATES = 3;

const idOf = (timer) => String(timer.id ?? timer._id);
// Evergreen timers have no global end, so they sort after fixed timers of the same specificity.
const endOf = (timer) => (timer.type === "evergreen" ? Infinity : toMs(timer.endAt));

function compare(a, b) {
  const specificity = SPECIFICITY[a.targeting.scope] - SPECIFICITY[b.targeting.scope];
  if (specificity !== 0) return specificity;
  const endA = endOf(a);
  const endB = endOf(b);
  if (endA !== endB) return endA < endB ? -1 : 1;
  const recency = toMs(b.updatedAt) - toMs(a.updatedAt);
  if (recency !== 0) return recency;
  return idOf(a) < idOf(b) ? -1 : 1;
}

/** Product > collection > all, then soonest end, then latest update, then id. */
export function rankCandidates(timers) {
  return [...timers].sort(compare);
}

/** `endedIds` holds evergreen timers that reached zero for this visitor during this page view. */
export function isLive(timer, now, endedIds = new Set()) {
  if (endedIds.has(idOf(timer))) return false;
  if (timer.type === "evergreen") return true;
  return toMs(timer.startAt) <= now && now < toMs(timer.endAt);
}

export function selectTimer(ranked, now, endedIds = new Set()) {
  return ranked.find((timer) => isLive(timer, now, endedIds)) ?? null;
}

/** Top live timer plus the next highest-ranked, so timers yet to start never push out a live one. */
export function pickCandidates(ranked, now, max = MAX_CANDIDATES) {
  const live = selectTimer(ranked, now);
  const others = ranked.filter((timer) => timer !== live);
  const kept = new Set([...(live ? [live] : []), ...others.slice(0, live ? max - 1 : max)]);
  return ranked.filter((timer) => kept.has(timer));
}
