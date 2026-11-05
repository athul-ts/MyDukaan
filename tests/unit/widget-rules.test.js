import { describe, expect, it } from "vitest";
import { formatCountdown, isUrgent } from "../../shared/countdown.js";
import { CACHE_LIFE_MS, shouldRefetch, STALE_AFTER_MS } from "../../shared/refetch.js";

const pulse = { mode: "color_pulse", thresholdMinutes: 5 };

describe("T-11 isUrgent", () => {
  it("is urgent at the exact threshold, and not one millisecond above it", () => {
    expect(isUrgent(5 * 60000, pulse)).toBe(true);
    expect(isUrgent(5 * 60000 + 1, pulse)).toBe(false);
  });

  it("is never urgent in none mode", () => {
    expect(isUrgent(1, { mode: "none", thresholdMinutes: 5 })).toBe(false);
  });
});

describe("T-11 formatCountdown", () => {
  it("omits days when zero", () => {
    expect(formatCountdown(3661000)).toBe("01:01:01");
  });

  it("includes days when there are any", () => {
    expect(formatCountdown(90061000)).toBe("01:01:01:01");
  });

  it("rounds up, so it only shows zero once time has run out", () => {
    expect(formatCountdown(1)).toBe("00:00:01");
    expect(formatCountdown(0)).toBe("00:00:00");
  });

  it("never goes negative", () => {
    expect(formatCountdown(-5000)).toBe("00:00:00");
  });
});

describe("T-13 shouldRefetch", () => {
  const now = 1_000_000_000;

  it("refetches on tab return only when data is older than 5 minutes", () => {
    const event = "tabVisible";
    expect(shouldRefetch({ event, now, lastFetchAt: now - STALE_AFTER_MS })).toBeNull();
    expect(shouldRefetch({ event, now, lastFetchAt: now - STALE_AFTER_MS - 1 })).toBe(0);
  });

  it("waits past the cache life when all candidates ended, so the cache can't return them", () => {
    const event = "allEnded";
    expect(shouldRefetch({ event, now, lastFetchAt: now - 50000 })).toBe(CACHE_LIFE_MS - 50000);
    expect(shouldRefetch({ event, now, lastFetchAt: now - CACHE_LIFE_MS - 1 })).toBe(0);
  });

  it("refetches only once for a list, so it can't loop", () => {
    expect(
      shouldRefetch({ event: "allEnded", now, lastFetchAt: 0, alreadyRefetchedList: true }),
    ).toBeNull();
  });

  it("ignores unknown events, so there's no other way to poll", () => {
    expect(shouldRefetch({ event: "tick", now, lastFetchAt: 0 })).toBeNull();
  });
});
