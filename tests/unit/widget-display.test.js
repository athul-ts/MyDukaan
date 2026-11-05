import { describe, expect, it, vi } from "vitest";
import { nextTickDelay } from "../../shared/countdown.js";
import {
  allCandidatesOver,
  nextWaitDelay,
  parsePublicTimers,
  resolveDisplay,
  resolvePlacement,
} from "../../shared/display.js";
import { fetchCandidates, sendImpression } from "../../widget/src/api.js";

const NOW = Date.parse("2030-01-01T12:00:00.000Z");
const iso = (offsetMs) => new Date(NOW + offsetMs).toISOString();

const fixed = (id, startOffset, endOffset) => ({
  id,
  type: "fixed",
  startAt: iso(startOffset),
  endAt: iso(endOffset),
  durationMinutes: null,
  headline: "Ends in",
  description: "",
  style: { backgroundColor: "#000000", textColor: "#ffffff", size: "medium", position: "inline" },
  urgency: { mode: "none", thresholdMinutes: 5 },
});
const evergreen = (id) => ({ ...fixed(id, 0, 0), type: "evergreen", startAt: null, endAt: null, durationMinutes: 10 });

const endOf = (ends = {}) => (timer) => ends[timer.id] ?? Date.parse(timer.endAt);

describe("resolveDisplay (G5, state table in specs/05-widget.md)", () => {
  it("shows the first live timer", () => {
    const timer = fixed("a", -1000, 1000);
    expect(resolveDisplay([timer], NOW, new Set(), endOf(), null)).toEqual({
      state: "live",
      timer,
      end: NOW + 1000,
    });
  });

  it("stays empty when no timer has been seen, including a list of only ended timers", () => {
    expect(resolveDisplay([], NOW, new Set(), endOf(), null).state).toBe("empty");
    expect(resolveDisplay([fixed("a", -2000, -1000)], NOW, new Set(), endOf(), null).state).toBe("empty");
    expect(resolveDisplay([fixed("a", 1000, 2000)], NOW, new Set(), endOf(), null).state).toBe("empty");
  });

  it("switches to the next live timer when one ends", () => {
    const ended = fixed("a", -2000, -1000);
    const next = fixed("b", -2000, 5000);
    const display = resolveDisplay([ended, next], NOW, new Set(), endOf(), ended);
    expect(display.state).toBe("live");
    expect(display.timer.id).toBe("b");
  });

  it("shows Offer ended for the timer that was on screen, when nothing else is live", () => {
    const ended = fixed("a", -2000, -1000);
    expect(resolveDisplay([ended], NOW, new Set(), endOf(), ended)).toEqual({ state: "ended", timer: ended });
  });

  it("ends a run-out evergreen timer for this page view, handing over to the next", () => {
    const first = evergreen("a");
    const second = fixed("b", -1000, 9000);
    const endedIds = new Set();
    const display = resolveDisplay([first, second], NOW, endedIds, endOf({ a: NOW }), first);
    expect(display.timer.id).toBe("b");
    expect(endedIds.has("a")).toBe(true);
  });

  it("doesn't restart an ended evergreen timer on a later tick", () => {
    const first = evergreen("a");
    const start = vi.fn(() => NOW + 60000);
    const display = resolveDisplay([first], NOW, new Set(["a"]), start, first);
    expect(display).toEqual({ state: "ended", timer: first });
    expect(start).not.toHaveBeenCalled();
  });

  it("only starts the countdown of the evergreen timer actually shown", () => {
    const live = fixed("a", -1000, 5000);
    const start = vi.fn(endOf());
    resolveDisplay([live, evergreen("b")], NOW, new Set(), start, null);
    expect(start.mock.calls.map(([timer]) => timer.id)).toEqual(["a"]);
  });
});

describe("allCandidatesOver (allows the one refetch)", () => {
  it("never holds for an empty response, so an empty list can't refetch", () => {
    expect(allCandidatesOver([], NOW, new Set())).toBe(false);
  });

  it("holds only once every fixed timer has ended and every evergreen has run out", () => {
    const ended = fixed("a", -2000, -1000);
    expect(allCandidatesOver([ended], NOW, new Set())).toBe(true);
    expect(allCandidatesOver([ended, fixed("b", 1000, 2000)], NOW, new Set())).toBe(false);
    expect(allCandidatesOver([ended, evergreen("c")], NOW, new Set())).toBe(false);
    expect(allCandidatesOver([ended, evergreen("c")], NOW, new Set(["c"]))).toBe(true);
  });
});

describe("resolvePlacement (zero CLS)", () => {
  it("renders inline in a reserved box, without resizing it", () => {
    expect(resolvePlacement("inline", { reserved: 72 })).toEqual({ position: "inline", expand: false });
  });

  it("only expands the box when the hint is missing", () => {
    expect(resolvePlacement("inline", { reserved: 0, hintMissing: true })).toEqual({ position: "inline", expand: true });
  });

  it("turns inline into the chosen bar when Liquid reserved no box", () => {
    expect(resolvePlacement("inline", { reserved: 0, hintMissing: false, bar: "bottom_bar" })).toEqual({
      position: "bottom_bar",
      expand: false,
    });
  });

  it("always renders a bar as a bar, leaving any reserved box empty", () => {
    expect(resolvePlacement("top_bar", { reserved: 72 })).toEqual({ position: "top_bar", expand: false });
  });
});

describe("parsePublicTimers (M-22)", () => {
  it("keeps valid timers of both types", () => {
    const timers = [fixed("a", 0, 1000), evergreen("b")];
    expect(parsePublicTimers({ timers })).toEqual(timers);
  });

  it.each([[null], ["text"], [{}], [{ timers: "nope" }]])("treats %j as no timers", (body) => {
    expect(parsePublicTimers(body)).toEqual([]);
  });

  it("drops a timer with an unsafe colour, as colours reach style properties", () => {
    const bad = fixed("a", 0, 1000);
    bad.style.backgroundColor = "red;background:url(//evil)";
    expect(parsePublicTimers({ timers: [bad, fixed("b", 0, 1000)] }).map((timer) => timer.id)).toEqual(["b"]);
  });

  it("drops malformed timers without throwing", () => {
    const missingStyle = { ...fixed("a", 0, 1000), style: undefined };
    const badDate = { ...fixed("b", 0, 1000), endAt: "soon" };
    const badDuration = { ...evergreen("c"), durationMinutes: 0 };
    const badSize = fixed("d", 0, 1000);
    badSize.style.size = "huge";
    expect(parsePublicTimers({ timers: [null, 7, missingStyle, badDate, badDuration, badSize] })).toEqual([]);
  });
});

describe("nextTickDelay (NFR-18)", () => {
  it("waits exactly until the displayed second changes", () => {
    expect(nextTickDelay(5400)).toBe(400);
    expect(nextTickDelay(5000)).toBe(1000);
    expect(nextTickDelay(1)).toBe(1);
  });

  it("re-ticks almost at once once time has run out", () => {
    expect(nextTickDelay(0)).toBe(1);
    expect(nextTickDelay(-250)).toBe(1);
  });
});

describe("nextWaitDelay (a timer appears at its start, not up to a second later)", () => {
  it("waits for the next whole second when no start is sooner", () => {
    expect(nextWaitDelay([], NOW + 250)).toBe(750);
    expect(nextWaitDelay([fixed("a", 60000, 120000)], NOW + 250)).toBe(750);
  });

  it("wakes exactly at a start inside the current second", () => {
    expect(nextWaitDelay([fixed("a", 400, 120000)], NOW + 250)).toBe(150);
  });

  it("ignores starts already passed and evergreen timers", () => {
    expect(nextWaitDelay([fixed("a", -5000, 120000), evergreen("b")], NOW + 250)).toBe(750);
  });
});

describe("fetchCandidates (failure handling)", () => {
  const ok = (body) => ({ ok: true, status: 200, json: async () => body });
  const status = (code) => ({ ok: false, status: code, json: async () => ({}) });
  const options = (fetchImpl) => ({ fetchImpl, wait: async () => {}, delay: () => 0, timeoutMs: 50 });

  it("returns the parsed timers", async () => {
    const fetchImpl = vi.fn(async () => ok({ timers: [evergreen("a")] }));
    expect(await fetchCandidates("/t", options(fetchImpl))).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("retries once after a server error or network failure", async () => {
    const after500 = vi.fn().mockResolvedValueOnce(status(500)).mockResolvedValueOnce(ok({ timers: [] }));
    expect(await fetchCandidates("/t", options(after500))).toEqual([]);
    expect(after500).toHaveBeenCalledTimes(2);

    const afterNetwork = vi.fn().mockRejectedValueOnce(new TypeError("failed")).mockResolvedValueOnce(ok({ timers: [] }));
    expect(await fetchCandidates("/t", options(afterNetwork))).toEqual([]);
    expect(afterNetwork).toHaveBeenCalledTimes(2);
  });

  it("gives up after the one retry, without throwing", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("failed");
    });
    expect(await fetchCandidates("/t", options(fetchImpl))).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it.each([400, 404, 429])("doesn't retry a %i", async (code) => {
    const fetchImpl = vi.fn(async () => status(code));
    expect(await fetchCandidates("/t", options(fetchImpl))).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("treats invalid JSON as a failure, without retrying", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("bad");
      },
    }));
    expect(await fetchCandidates("/t", options(fetchImpl))).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("aborts a request that takes too long", async () => {
    const fetchImpl = vi.fn(
      (_url, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        }),
    );
    expect(await fetchCandidates("/t", options(fetchImpl))).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe("sendImpression (FR-11)", () => {
  const BODY = JSON.stringify({ timerId: "a" });

  it("uses sendBeacon", () => {
    const nav = { sendBeacon: vi.fn(() => true) };
    const fetchImpl = vi.fn();
    sendImpression("/apps/countdown", "a", { nav, fetchImpl });
    expect(nav.sendBeacon).toHaveBeenCalledWith("/apps/countdown/impressions", BODY);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("falls back to a keepalive fetch", () => {
    for (const nav of [{}, { sendBeacon: () => false }]) {
      const fetchImpl = vi.fn(async () => {});
      sendImpression("/apps/countdown", "a", { nav, fetchImpl });
      expect(fetchImpl).toHaveBeenCalledWith("/apps/countdown/impressions", { method: "POST", body: BODY, keepalive: true });
    }
  });

  it("never lets a failure reach the page", async () => {
    const throwing = { sendBeacon: () => { throw new Error("blocked"); } };
    expect(() => sendImpression("/x", "a", { nav: throwing, fetchImpl: vi.fn() })).not.toThrow();
    const rejected = vi.fn(async () => { throw new Error("network"); });
    expect(() => sendImpression("/x", "a", { nav: {}, fetchImpl: rejected })).not.toThrow();
    await rejected.mock.results[0].value.catch(() => {});
  });
});
