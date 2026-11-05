import { describe, expect, it } from "vitest";
import { buildHint, HINT_MAX_BYTES, serializeHint } from "../../shared/hint.js";
import { findOverlaps } from "../../shared/overlaps.js";

const NOW = Date.parse("2026-11-20T12:00:00.000Z");
const HOUR = 3600000;

const timer = (id, overrides = {}) => ({
  _id: id,
  name: "SECRET MERCHANT NAME",
  description: "SECRET DESCRIPTION",
  type: "fixed",
  startAt: new Date(NOW - HOUR),
  endAt: new Date(NOW + HOUR),
  updatedAt: new Date(NOW),
  style: { size: "medium", position: "inline" },
  ...overrides,
  targeting: { scope: "all", productIds: [], collectionIds: [], ...overrides.targeting },
});

describe("T-8 buildHint", () => {
  it("excludes expired timers, and keeps scheduled and evergreen ones", () => {
    const hint = buildHint(
      [
        timer("expired", { startAt: new Date(NOW - 2 * HOUR), endAt: new Date(NOW - HOUR) }),
        timer("scheduled", { startAt: new Date(NOW + HOUR), endAt: new Date(NOW + 2 * HOUR) }),
        timer("evergreen", { type: "evergreen", startAt: null, endAt: null }),
      ],
      NOW,
    );
    expect(hint.t).toHaveLength(2);
  });

  it("orders entries the same way selection does", () => {
    const hint = buildHint(
      [
        timer("all"),
        timer("product", { targeting: { scope: "products", productIds: ["1"] } }),
        timer("collection", { targeting: { scope: "collections", collectionIds: ["2"] } }),
      ],
      NOW,
    );
    expect(hint.t.map((entry) => [entry.a, entry.p, entry.c])).toEqual([
      [false, "|1|", ""],
      [false, "", "|2|"],
      [true, "", ""],
    ]);
  });

  it("delimits IDs, so a longer or shorter ID can't match", () => {
    const [entry] = buildHint(
      [timer("p", { targeting: { scope: "products", productIds: ["123", "456"] } })],
      NOW,
    ).t;
    expect(entry.p).toBe("|123|456|");
    expect(entry.p.includes("|123|")).toBe(true);
    expect(entry.p.includes("|1234|")).toBe(false);
    expect(entry.p.includes("|23|")).toBe(false);
  });

  it("uses epoch seconds for fixed timers, and null for evergreen", () => {
    const [fixed] = buildHint([timer("f")], NOW).t;
    expect(fixed.s).toBe(Math.floor((NOW - HOUR) / 1000));
    expect(fixed.e).toBe(Math.floor((NOW + HOUR) / 1000));
    const [evergreen] = buildHint([timer("e", { type: "evergreen", startAt: null, endAt: null })], NOW).t;
    expect(evergreen.s).toBeNull();
    expect(evergreen.e).toBeNull();
  });

  it("contains no merchant text", () => {
    expect(JSON.stringify(buildHint([timer("t")], NOW))).not.toContain("SECRET");
  });
});

describe("T-8 serializeHint", () => {
  it("writes the hint when it fits", () => {
    const hint = buildHint([timer("t")], NOW);
    expect(JSON.parse(serializeHint(hint))).toEqual(hint);
  });

  it("writes the overflow marker over 120KB", () => {
    const productIds = Array.from({ length: 250 }, (_, i) => String(15469992180000 + i));
    const timers = Array.from({ length: 40 }, (_, i) =>
      timer(String(i), { targeting: { scope: "products", productIds } }),
    );
    const hint = buildHint(timers, NOW);
    expect(JSON.stringify(hint).length).toBeGreaterThan(HINT_MAX_BYTES);
    expect(JSON.parse(serializeHint(hint))).toEqual({ v: 1, overflow: true });
  });
});

describe("findOverlaps", () => {
  it("flags competing timers in both directions", () => {
    const overlaps = findOverlaps([timer("a"), timer("b")], NOW);
    expect(overlaps.get("a")).toEqual(["b"]);
    expect(overlaps.get("b")).toEqual(["a"]);
  });

  it("ignores different products, separate time windows and expired timers", () => {
    const overlaps = findOverlaps(
      [
        timer("p1", { targeting: { scope: "products", productIds: ["1"] } }),
        timer("p2", { targeting: { scope: "products", productIds: ["2"] } }),
        timer("later", {
          startAt: new Date(NOW + 2 * HOUR),
          endAt: new Date(NOW + 3 * HOUR),
          targeting: { scope: "products", productIds: ["1"] },
        }),
        timer("done", {
          startAt: new Date(NOW - 2 * HOUR),
          endAt: new Date(NOW - HOUR),
          targeting: { scope: "all" },
        }),
      ],
      NOW,
    );
    for (const list of overlaps.values()) expect(list).toEqual([]);
  });
});
