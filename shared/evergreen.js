import { MINUTE_MS } from "./time.js";

export const SESSION_IDLE_MS = 30 * MINUTE_MS;
const KEY_PREFIX = "cdt:";

/** Only a duration change restarts a visitor's countdown. Other edits, such as a typo fix, don't. */
export function evergreenKey(timerId, durationMinutes) {
  return `${KEY_PREFIX}${timerId}:${durationMinutes}`;
}

function parse(raw) {
  try {
    const value = JSON.parse(raw);
    return Number.isFinite(value?.startedAt) && Number.isFinite(value?.lastSeenAt) ? value : null;
  } catch {
    return null;
  }
}

/** Decides on page load whether a visitor continues their countdown or starts a new one. */
export function resolveEvergreen(raw, durationMinutes, now) {
  const stored = parse(raw);
  const mustRestart =
    !stored ||
    stored.startedAt > now ||
    now >= stored.startedAt + durationMinutes * MINUTE_MS ||
    now - stored.lastSeenAt > SESSION_IDLE_MS;
  if (mustRestart) return { startedAt: now, lastSeenAt: now };
  return { startedAt: stored.startedAt, lastSeenAt: now };
}

/** Wraps Web Storage, falling back to memory if it's blocked. Never throws. */
export function createEvergreenStore(getStorage) {
  const memory = new Map();
  let storage = null;
  try {
    storage = getStorage();
    if (storage) {
      const probe = `${KEY_PREFIX}probe`;
      storage.setItem(probe, "1");
      storage.removeItem(probe);
    }
  } catch {
    storage = null;
  }

  const read = (key) => {
    try {
      if (storage) return storage.getItem(key);
    } catch {
      /* Fall through to memory. */
    }
    return memory.get(key) ?? null;
  };
  const write = (key, value) => {
    memory.set(key, value);
    try {
      if (storage) storage.setItem(key, value);
    } catch {
      /* Memory already holds it. */
    }
  };
  const removeOtherDurations = (timerId, keep) => {
    try {
      if (!storage) return;
      const prefix = `${KEY_PREFIX}${timerId}:`;
      for (let i = storage.length - 1; i >= 0; i--) {
        const key = storage.key(i);
        if (key?.startsWith(prefix) && key !== keep) storage.removeItem(key);
      }
    } catch {
      /* Stale keys are harmless. */
    }
  };

  return {
    /** Returns the countdown's end time, saving the visitor's state. */
    start(timerId, durationMinutes, now) {
      const key = evergreenKey(timerId, durationMinutes);
      const state = resolveEvergreen(read(key), durationMinutes, now);
      write(key, JSON.stringify(state));
      removeOtherDurations(timerId, key);
      return state.startedAt + durationMinutes * MINUTE_MS;
    },
    /** Refreshes lastSeenAt while the tab is visible, so an open tab isn't an idle session. */
    touch(timerId, durationMinutes, now) {
      const key = evergreenKey(timerId, durationMinutes);
      const state = resolveEvergreen(read(key), durationMinutes, now);
      write(key, JSON.stringify(state));
    },
  };
}
