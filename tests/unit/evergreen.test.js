import { describe, expect, it } from "vitest";
import {
  createEvergreenStore,
  evergreenKey,
  resolveEvergreen,
  SESSION_IDLE_MS,
} from "../../shared/evergreen.js";

const NOW = 1_800_000_000_000;
const MINUTE = 60000;
const DURATION = 60;
const stored = (startedAgo, seenAgo) =>
  JSON.stringify({ startedAt: NOW - startedAgo, lastSeenAt: NOW - seenAgo });
const fresh = { startedAt: NOW, lastSeenAt: NOW };

function fakeStorage() {
  const map = new Map();
  return {
    get length() {
      return map.size;
    },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, value),
    removeItem: (key) => map.delete(key),
    map,
  };
}

describe("T-3 resolveEvergreen", () => {
  it("starts on first visit", () => {
    expect(resolveEvergreen(null, DURATION, NOW)).toEqual(fresh);
  });

  it("continues within the duration and idle limit, refreshing lastSeenAt", () => {
    expect(resolveEvergreen(stored(10 * MINUTE, MINUTE), DURATION, NOW)).toEqual({
      startedAt: NOW - 10 * MINUTE,
      lastSeenAt: NOW,
    });
  });

  it("restarts at the exact moment the duration ends, not before", () => {
    expect(resolveEvergreen(stored(DURATION * MINUTE - 1, 0), DURATION, NOW).startedAt).toBe(
      NOW - DURATION * MINUTE + 1,
    );
    expect(resolveEvergreen(stored(DURATION * MINUTE, 0), DURATION, NOW)).toEqual(fresh);
  });

  it("restarts after more than 30 minutes idle, and continues at exactly 30", () => {
    expect(resolveEvergreen(stored(35 * MINUTE, SESSION_IDLE_MS), DURATION, NOW).startedAt).toBe(
      NOW - 35 * MINUTE,
    );
    expect(resolveEvergreen(stored(35 * MINUTE, SESSION_IDLE_MS + 1), DURATION, NOW)).toEqual(fresh);
  });

  it("restarts on corrupt data", () => {
    for (const raw of ["{not json", "null", "42", '{"startedAt":"x","lastSeenAt":1}', "{}"]) {
      expect(resolveEvergreen(raw, DURATION, NOW)).toEqual(fresh);
    }
  });

  it("restarts when the device clock moved back", () => {
    expect(resolveEvergreen(stored(-MINUTE, 0), DURATION, NOW)).toEqual(fresh);
  });
});

describe("T-3 createEvergreenStore", () => {
  it("persists across page loads, so a reload continues the countdown", () => {
    const storage = fakeStorage();
    const end = createEvergreenStore(() => storage).start("t1", DURATION, NOW);
    const later = createEvergreenStore(() => storage).start("t1", DURATION, NOW + MINUTE);
    expect(later).toBe(end);
    expect(end).toBe(NOW + DURATION * MINUTE);
  });

  it("restarts when the duration changes, and removes the old key", () => {
    const storage = fakeStorage();
    const store = createEvergreenStore(() => storage);
    store.start("t1", 60, NOW);
    const end = store.start("t1", 45, NOW + MINUTE);
    expect(end).toBe(NOW + MINUTE + 45 * MINUTE);
    expect(storage.map.has(evergreenKey("t1", 60))).toBe(false);
    expect(storage.map.has(evergreenKey("t1", 45))).toBe(true);
  });

  it("leaves other timers' keys alone", () => {
    const storage = fakeStorage();
    const store = createEvergreenStore(() => storage);
    store.start("t1", 60, NOW);
    store.start("t2", 60, NOW);
    expect(storage.map.has(evergreenKey("t1", 60))).toBe(true);
    expect(storage.map.has(evergreenKey("t2", 60))).toBe(true);
  });

  it("doesn't restart a countdown when other edits leave the duration alone", () => {
    expect(evergreenKey("t1", 60)).toBe(evergreenKey("t1", 60));
    expect(evergreenKey("t1", 60)).not.toBe(evergreenKey("t1", 45));
  });

  it("falls back to memory when reading storage throws", () => {
    const store = createEvergreenStore(() => {
      throw new Error("blocked");
    });
    const end = store.start("t1", DURATION, NOW);
    expect(store.start("t1", DURATION, NOW + MINUTE)).toBe(end);
  });

  it("falls back to memory when writing to storage throws", () => {
    const blocked = { ...fakeStorage(), setItem: () => { throw new Error("quota"); } };
    const store = createEvergreenStore(() => blocked);
    const end = store.start("t1", DURATION, NOW);
    expect(store.start("t1", DURATION, NOW + MINUTE)).toBe(end);
  });

  it("restarts on each page load when storage is blocked, as a new store has no memory", () => {
    const blocked = () => {
      throw new Error("blocked");
    };
    const first = createEvergreenStore(blocked).start("t1", DURATION, NOW);
    const second = createEvergreenStore(blocked).start("t1", DURATION, NOW + MINUTE);
    expect(second).toBe(first + MINUTE);
  });
});
