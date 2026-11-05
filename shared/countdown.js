import { MINUTE_MS } from "./time.js";

export function isUrgent(remainingMs, urgency) {
  return urgency.mode !== "none" && remainingMs <= urgency.thresholdMinutes * MINUTE_MS;
}

const pad = (value) => String(value).padStart(2, "0");

/** HH:MM:SS, with days added in front only when there are any. Rounds up, so 0 means ended. */
export function formatCountdown(remainingMs) {
  const total = Math.max(0, Math.ceil(remainingMs / 1000));
  const days = Math.floor(total / 86400);
  const parts = [Math.floor((total % 86400) / 3600), Math.floor((total % 3600) / 60), total % 60];
  return (days > 0 ? [days, ...parts] : parts).map(pad).join(":");
}
