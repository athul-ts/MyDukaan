import { rankCandidates } from "./selection.js";
import { deriveStatus } from "./status.js";
import { toMs } from "./time.js";

/** Shopify rejects JSON metafields above 131,072 bytes (S2 in specs/10-spikes.md). */
export const HINT_MAX_BYTES = 120 * 1024;

// The delimiters stop Liquid's `contains` matching part of a longer ID.
const delimit = (ids) => (ids.length ? `|${ids.join("|")}|` : "");
const toSeconds = (value) => Math.floor(toMs(value) / 1000);

/** What Liquid needs to decide whether to reserve space. It never holds merchant text. */
export function buildHint(timers, now) {
  const entries = rankCandidates(timers.filter((timer) => deriveStatus(timer, now) !== "expired"));
  return {
    v: 1,
    t: entries.map((timer) => ({
      s: timer.type === "fixed" ? toSeconds(timer.startAt) : null,
      e: timer.type === "fixed" ? toSeconds(timer.endAt) : null,
      z: timer.style.size,
      o: timer.style.position,
      a: timer.targeting.scope === "all",
      p: delimit(timer.targeting.productIds ?? []),
      c: delimit(timer.targeting.collectionIds ?? []),
    })),
  };
}

/** Over the cap, Liquid treats the overflow marker as a missing hint and fetches anyway. */
export function serializeHint(hint) {
  const value = JSON.stringify(hint);
  return new TextEncoder().encode(value).length > HINT_MAX_BYTES
    ? JSON.stringify({ v: 1, overflow: true })
    : value;
}
