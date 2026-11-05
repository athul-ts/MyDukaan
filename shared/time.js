/** Accepts a Date, an ISO string or epoch milliseconds, and returns epoch milliseconds. */
export function toMs(value) {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

export const MINUTE_MS = 60 * 1000;
