import { parsePublicTimers } from "../../shared/display.js";

const TIMEOUT_MS = 3000;
const jitterMs = () => 1000 + Math.random() * 2000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function attempt(url, fetchImpl, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (response.status >= 500) return { retry: true };
    if (!response.ok) return { retry: false };
    try {
      return { timers: parsePublicTimers(await response.json()) };
    } catch (error) {
      // An aborted read is a timeout, which can be retried. Anything else is a bad body, which can't.
      return { retry: error?.name === "AbortError" };
    }
  } catch {
    return { retry: true };
  } finally {
    clearTimeout(timeout);
  }
}

/** Returns the ranked candidates, or null on failure. Never throws. */
export async function fetchCandidates(url, { fetchImpl = fetch, timeoutMs = TIMEOUT_MS, wait = sleep, delay = jitterMs } = {}) {
  const first = await attempt(url, fetchImpl, timeoutMs);
  if (first.timers) return first.timers;
  if (!first.retry) return null;
  await wait(delay());
  return (await attempt(url, fetchImpl, timeoutMs)).timers ?? null;
}

/** Fire and forget: a lost impression must never affect the visitor. */
export function sendImpression(proxy, timerId, { nav = navigator, fetchImpl = fetch } = {}) {
  const url = `${proxy}/impressions`;
  const body = JSON.stringify({ timerId });
  try {
    if (nav.sendBeacon?.(url, body)) return;
    fetchImpl(url, { method: "POST", body, keepalive: true }).catch(() => {});
  } catch {
    /* Ignored on purpose. */
  }
}
