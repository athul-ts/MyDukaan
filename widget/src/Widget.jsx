import { Component, render } from "preact";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { formatCountdown, isUrgent, nextTickDelay } from "../../shared/countdown.js";
import { allCandidatesOver, isBar, nextWaitDelay, resolveDisplay, resolvePlacement } from "../../shared/display.js";
import { shouldRefetch } from "../../shared/refetch.js";
import { toMs } from "../../shared/time.js";
import { fetchCandidates, sendImpression } from "./api.js";

const BOX_HEIGHT = { small: 56, medium: 72, large: 96 };
const TOUCH_EVERY_MS = 60 * 1000;

/** Any render failure leaves the reserved box empty, so the storefront carries on. */
export class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Fixed-width cells, so the box can't jitter in a font without tabular numerals. */
function Clock({ remaining }) {
  return (
    <div class="cdt-clock" role="timer" aria-live="off">
      {[...formatCountdown(remaining)].map((character, index) =>
        character === ":" ? character : <span class="cdt-digit" key={index}>{character}</span>,
      )}
    </div>
  );
}

export function Widget({ config, store, counted }) {
  const [ranked, setRanked] = useState([]);
  const [now, setNow] = useState(() => Date.now());
  const card = useRef(null);
  const session = useRef({
    endedIds: new Set(),
    evergreen: new Map(),
    lastShown: null,
    lastFetchAt: 0,
    lastTouchAt: 0,
    refetchedEnded: false,
  }).current;

  const load = useCallback(async () => {
    session.lastFetchAt = Date.now();
    const timers = await fetchCandidates(config.url);
    if (!timers) return;
    const fetchedAt = Date.now();
    if (!allCandidatesOver(timers, fetchedAt, session.endedIds)) session.refetchedEnded = false;
    setRanked(timers);
    setNow(fetchedAt);
  }, [config.url, session]);

  // Held for the page view, so an evergreen countdown never restarts mid-view, even after a refetch.
  const endOf = (timer) => {
    if (timer.type !== "evergreen") return toMs(timer.endAt);
    let state = session.evergreen.get(timer.id);
    if (!state) {
      // Uses the time this render displays against, or the first tick reads one second too high.
      const end = store.start(timer.id, timer.durationMinutes, now);
      state = { end, durationMinutes: timer.durationMinutes };
      session.evergreen.set(timer.id, state);
    }
    return state.end;
  };

  const display = resolveDisplay(ranked, now, session.endedIds, endOf, session.lastShown);
  if (display.state === "live") session.lastShown = display.timer;
  const liveId = display.state === "live" ? display.timer.id : null;
  const over = allCandidatesOver(ranked, now, session.endedIds);

  useEffect(() => {
    load();
    const onVisibility = () => {
      if (document.hidden) return;
      const current = Date.now();
      setNow(current);
      const delay = shouldRefetch({ event: "tabVisible", now: current, lastFetchAt: session.lastFetchAt });
      if (delay !== null) load();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [load, session]);

  // Runs after every tick. It stops while the tab is hidden, and when nothing can change any more.
  useEffect(() => {
    if (document.hidden || ranked.length === 0 || over) return undefined;
    const current = Date.now();
    if (liveId && session.evergreen.has(liveId) && current - session.lastTouchAt >= TOUCH_EVERY_MS) {
      session.lastTouchAt = current;
      store.touch(liveId, session.evergreen.get(liveId).durationMinutes, current);
    }
    const delay = display.state === "live" ? nextTickDelay(display.end - current) : nextWaitDelay(ranked, current);
    const timeout = setTimeout(() => setNow(Date.now()), delay);
    return () => clearTimeout(timeout);
  });

  useEffect(() => {
    if (!over || session.refetchedEnded) return undefined;
    session.refetchedEnded = true;
    const delay = shouldRefetch({ event: "allEnded", now: Date.now(), lastFetchAt: session.lastFetchAt });
    const timeout = setTimeout(load, delay);
    return () => clearTimeout(timeout);
  }, [over, load, session]);

  useEffect(() => {
    if (!liveId || !card.current || counted.has(liveId)) return undefined;
    if (typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        if (counted.has(liveId)) return;
        counted.add(liveId);
        sendImpression(config.proxy, liveId);
      },
      { threshold: 0.5 },
    );
    observer.observe(card.current);
    return () => observer.disconnect();
  }, [liveId, config.proxy, counted]);

  const timer = display.timer;
  const placement = timer ? resolvePlacement(timer.style.position, config) : null;

  useEffect(() => {
    // Only reached with a missing hint: the rare shift accepted in specs/05-widget.md.
    if (placement?.expand) config.root.style.height = `${BOX_HEIGHT[timer.style.size]}px`;
  }, [placement?.expand, timer?.style.size, config.root]);

  const showsBar = Boolean(placement) && isBar(placement.position);

  // A theme ancestor can trap a bar's z-index, so a bar lives on body. See specs/05-widget.md.
  useLayoutEffect(() => {
    if (!showsBar) return undefined;
    const { root } = config;
    const spacer = document.createElement("div");
    spacer.style.height = root.style.height;
    root.replaceWith(spacer);
    document.body.append(root);
    root.classList.remove("cdt-root");
    root.style.display = "contents";
    // The theme editor replaces a section's HTML and mounts its new root, so the moved one must go.
    const onSectionUnload = (event) => {
      if (!event.target.contains?.(spacer)) return;
      render(null, root);
      root.remove();
    };
    document.addEventListener("shopify:section:unload", onSectionUnload);
    return () => {
      document.removeEventListener("shopify:section:unload", onSectionUnload);
      root.style.display = "";
      root.classList.add("cdt-root");
      spacer.replaceWith(root);
    };
  }, [showsBar, config]);

  if (!timer) return null;
  const ended = display.state === "ended";
  if (ended && isBar(placement.position)) return null;

  const remaining = ended ? 0 : display.end - now;
  const { size, backgroundColor, textColor } = timer.style;
  const urgent = !ended && isUrgent(remaining, timer.urgency);
  const classes = `cdt-card cdt-${size} cdt-${placement.position}${urgent ? " cdt-urgent" : ""}`;

  return (
    // Keyed so a switch between bar and inline is a new element, not one that moved (a layout shift).
    <div key={placement.position} ref={card} class={classes} style={{ "--cdt-bg": backgroundColor, "--cdt-fg": textColor }}>
      <div class="cdt-body">
        {ended ? (
          // Keyed so it's a new element. Reusing a row would count as that row moving (a layout shift).
          <div key="ended" class="cdt-clock cdt-ended">Offer ended</div>
        ) : (
          <>
            {timer.headline ? <div class="cdt-headline">{timer.headline}</div> : null}
            <Clock remaining={remaining} />
            {size !== "small" && timer.description ? <div class="cdt-description">{timer.description}</div> : null}
          </>
        )}
      </div>
    </div>
  );
}
