import { describe, expect, it } from "vitest";
import { deriveStatus } from "../../shared/status.js";
import {
  isLive,
  LEAD_IN_MS,
  pickCandidates,
  rankCandidates,
  selectTimer,
} from "../../shared/selection.js";

const NOW = Date.parse("2026-11-20T12:00:00.000Z");
const at = (offsetMs) => new Date(NOW + offsetMs);
const HOUR = 3600000;

const fixed = (id, scope, startOffset, endOffset, updatedOffset = 0) => ({
  id,
  type: "fixed",
  startAt: at(startOffset),
  endAt: at(endOffset),
  updatedAt: at(updatedOffset),
  targeting: { scope },
});
const evergreen = (id, scope, updatedOffset = 0) => ({
  id,
  type: "evergreen",
  startAt: null,
  endAt: null,
  durationMinutes: 30,
  updatedAt: at(updatedOffset),
  targeting: { scope },
});
const ids = (timers) => timers.map((timer) => timer.id);

describe("T-1 deriveStatus", () => {
  it("is always active for evergreen", () => {
    expect(deriveStatus(evergreen("e", "all"), NOW)).toBe("active");
  });

  it("is scheduled until the exact start, and active from it", () => {
    const timer = fixed("f", "all", 0, HOUR);
    expect(deriveStatus(timer, NOW - 1)).toBe("scheduled");
    expect(deriveStatus(timer, NOW)).toBe("active");
  });

  it("is active until the exact end, and expired from it", () => {
    const timer = fixed("f", "all", -HOUR, 0);
    expect(deriveStatus(timer, NOW - 1)).toBe("active");
    expect(deriveStatus(timer, NOW)).toBe("expired");
  });
});

describe("T-2 rankCandidates", () => {
  it("ranks product above collection above all, whatever the end time", () => {
    const ranked = rankCandidates([
      fixed("all", "all", -HOUR, HOUR),
      fixed("product", "products", -HOUR, 3 * HOUR),
      fixed("collection", "collections", -HOUR, 2 * HOUR),
    ]);
    expect(ids(ranked)).toEqual(["product", "collection", "all"]);
  });

  it("breaks a specificity tie by the soonest end", () => {
    const ranked = rankCandidates([fixed("later", "all", -HOUR, 2 * HOUR), fixed("sooner", "all", -HOUR, HOUR)]);
    expect(ids(ranked)).toEqual(["sooner", "later"]);
  });

  it("sorts evergreen after fixed of equal specificity, but above lower specificity", () => {
    const ranked = rankCandidates([
      fixed("fixedAll", "all", -HOUR, HOUR),
      evergreen("everProduct", "products"),
      fixed("fixedProduct", "products", -HOUR, 9 * HOUR),
    ]);
    expect(ids(ranked)).toEqual(["fixedProduct", "everProduct", "fixedAll"]);
  });

  it("breaks an end time tie by the latest update, then by id", () => {
    const ranked = rankCandidates([
      fixed("b", "all", -HOUR, HOUR, -5),
      fixed("old", "all", -HOUR, HOUR, -10),
      fixed("a", "all", -HOUR, HOUR, -5),
      fixed("new", "all", -HOUR, HOUR, 0),
    ]);
    expect(ids(ranked)).toEqual(["new", "a", "b", "old"]);
  });

  it("doesn't change its input", () => {
    const input = [fixed("b", "all", -HOUR, 2 * HOUR), fixed("a", "all", -HOUR, HOUR)];
    rankCandidates(input);
    expect(ids(input)).toEqual(["b", "a"]);
  });
});

describe("T-2 selectTimer", () => {
  it("lets a future candidate go live from a cached list without refetching", () => {
    const ranked = rankCandidates([fixed("soon", "products", 2 * 60000, HOUR), fixed("now", "all", -HOUR, HOUR)]);
    expect(selectTimer(ranked, NOW).id).toBe("now");
    expect(selectTimer(ranked, NOW + 2 * 60000).id).toBe("soon");
  });

  it("returns null when nothing is live", () => {
    expect(selectTimer([fixed("ended", "all", -2 * HOUR, -HOUR)], NOW)).toBeNull();
  });

  it("hands over when an evergreen timer ends for this visitor mid-view", () => {
    const ranked = rankCandidates([evergreen("ever", "products"), fixed("next", "all", -HOUR, HOUR)]);
    expect(selectTimer(ranked, NOW).id).toBe("ever");
    expect(selectTimer(ranked, NOW, new Set(["ever"])).id).toBe("next");
    expect(isLive(ranked[0], NOW, new Set(["ever"]))).toBe(false);
  });
});

describe("pickCandidates", () => {
  it("never lets timers that haven't started push out a live one", () => {
    const ranked = rankCandidates([
      fixed("soon1", "products", 60000, HOUR),
      fixed("soon2", "products", 60000, 2 * HOUR),
      fixed("soon3", "products", 60000, 3 * HOUR),
      fixed("live", "all", -HOUR, HOUR),
    ]);
    const picked = pickCandidates(ranked, NOW);
    expect(picked).toHaveLength(3);
    expect(ids(picked)).toEqual(["soon1", "soon2", "live"]);
  });

  it("takes the top three when none is live, and allows the whole lead-in window", () => {
    const ranked = rankCandidates(["a", "b", "c", "d"].map((id, i) => fixed(id, "all", LEAD_IN_MS, HOUR + i)));
    expect(ids(pickCandidates(ranked, NOW))).toEqual(["a", "b", "c"]);
  });
});
