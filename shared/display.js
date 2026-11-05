import { selectTimer } from "./selection.js";
import { toMs } from "./time.js";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const SIZES = ["small", "medium", "large"];
const POSITIONS = ["inline", "top_bar", "bottom_bar"];
const URGENCY_MODES = ["none", "color_pulse"];

export const isBar = (position) => position !== "inline";

function isValidTimer(timer) {
  if (typeof timer?.id !== "string" || !timer.id) return false;
  if (typeof timer.headline !== "string" || typeof timer.description !== "string") return false;
  const { style, urgency } = timer;
  if (!HEX_COLOR.test(style?.backgroundColor) || !HEX_COLOR.test(style?.textColor)) return false;
  if (!SIZES.includes(style.size) || !POSITIONS.includes(style.position)) return false;
  if (!URGENCY_MODES.includes(urgency?.mode) || !Number.isFinite(urgency.thresholdMinutes)) return false;
  if (timer.type === "evergreen") return Number.isFinite(timer.durationMinutes) && timer.durationMinutes > 0;
  if (timer.type !== "fixed") return false;
  return Number.isFinite(toMs(timer.startAt)) && Number.isFinite(toMs(timer.endAt));
}

/** A bad response must not reach rendering, so the widget checks it without pulling in zod. */
export function parsePublicTimers(body) {
  return Array.isArray(body?.timers) ? body.timers.filter(isValidTimer) : [];
}

/**
 * What the widget shows now. `endOf` gives a timer's end time for this visitor. An evergreen timer
 * that has run out joins `endedIds`, so it hands over and can't restart during this page view.
 */
export function resolveDisplay(ranked, now, endedIds, endOf, lastShown) {
  let timer = selectTimer(ranked, now, endedIds);
  while (timer) {
    const end = endOf(timer);
    if (now < end) return { state: "live", timer, end };
    endedIds.add(timer.id);
    timer = selectTimer(ranked, now, endedIds);
  }
  return lastShown ? { state: "ended", timer: lastShown } : { state: "empty", timer: null };
}

/** True when no timer in a non-empty list can show again, which permits the one refetch. */
export function allCandidatesOver(ranked, now, endedIds) {
  if (ranked.length === 0) return false;
  return ranked.every((timer) =>
    timer.type === "evergreen" ? endedIds.has(timer.id) : now >= toMs(timer.endAt),
  );
}

/** With nothing live, waits for the next whole second, or the next start if that comes first. */
export function nextWaitDelay(ranked, now) {
  const untilSecond = 1000 - (now % 1000);
  const starts = ranked
    .filter((timer) => timer.type === "fixed")
    .map((timer) => toMs(timer.startAt) - now)
    .filter((untilStart) => untilStart > 0);
  return Math.min(untilSecond, ...starts);
}

/**
 * Where a timer renders, given what Liquid reserved. Only a missing hint may expand the box. With a
 * readable hint and no box, Liquid chose a bar, so an inline timer becomes that bar instead of
 * shifting the page.
 */
export function resolvePlacement(position, { reserved, hintMissing, bar }) {
  if (isBar(position) || reserved > 0) return { position, expand: false };
  if (hintMissing) return { position, expand: true };
  return { position: bar || "top_bar", expand: false };
}
