import { deriveStatus } from "./status.js";
import { toMs } from "./time.js";

const windowOf = (timer) =>
  timer.type === "evergreen" ? [-Infinity, Infinity] : [toMs(timer.startAt), toMs(timer.endAt)];

function timesIntersect(a, b) {
  const [startA, endA] = windowOf(a);
  const [startB, endB] = windowOf(b);
  return startA < endB && startB < endA;
}

function targetsCouldCoincide(a, b) {
  const scopeA = a.targeting.scope;
  const scopeB = b.targeting.scope;
  if (scopeA === "all" || scopeB === "all") return true;
  // Which products sit in which collections isn't known here, so assume they could overlap.
  if (scopeA !== scopeB) return true;
  const key = scopeA === "products" ? "productIds" : "collectionIds";
  const ids = new Set(a.targeting[key]);
  return b.targeting[key].some((id) => ids.has(id));
}

/** Advisory only. Selection already resolves conflicts, so this never blocks a save. */
export function findOverlaps(timers, now) {
  const current = timers.filter((timer) => deriveStatus(timer, now) !== "expired");
  const overlaps = new Map(timers.map((timer) => [String(timer.id ?? timer._id), []]));
  current.forEach((a, i) => {
    for (const b of current.slice(i + 1)) {
      if (timesIntersect(a, b) && targetsCouldCoincide(a, b)) {
        const idA = String(a.id ?? a._id);
        const idB = String(b.id ?? b._id);
        overlaps.get(idA).push(idB);
        overlaps.get(idB).push(idA);
      }
    }
  });
  return overlaps;
}
