import { toMs } from "./time.js";

/** Derived at read time and never stored, so no scheduled job is needed. */
export function deriveStatus(timer, now) {
  if (timer.type === "evergreen") return "active";
  if (now < toMs(timer.startAt)) return "scheduled";
  if (now >= toMs(timer.endAt)) return "expired";
  return "active";
}
