import { deriveStatus } from "../shared/status.js";

const iso = (date) => (date ? new Date(date).toISOString() : null);

/**
 * The storefront response is an explicit allowlist. Merchant names, targeting lists, impressions
 * and internal timestamps must never appear here.
 */
export function toPublicTimer(timer) {
  return {
    id: String(timer._id),
    type: timer.type,
    startAt: iso(timer.startAt),
    endAt: iso(timer.endAt),
    durationMinutes: timer.durationMinutes ?? null,
    headline: timer.headline,
    description: timer.description,
    style: {
      backgroundColor: timer.style.backgroundColor,
      textColor: timer.style.textColor,
      size: timer.style.size,
      position: timer.style.position,
    },
    urgency: { mode: timer.urgency.mode, thresholdMinutes: timer.urgency.thresholdMinutes },
  };
}

export function toAdminTimer(timer, { impressions = 0, now = Date.now(), overlapsWith } = {}) {
  const { scope, labels = [] } = timer.targeting;
  const resources = labels.map(({ id, title }) => ({ id, title }));
  return {
    id: String(timer._id),
    name: timer.name,
    type: timer.type,
    status: deriveStatus(timer, now),
    startAt: iso(timer.startAt),
    endAt: iso(timer.endAt),
    durationMinutes: timer.durationMinutes ?? null,
    headline: timer.headline,
    description: timer.description,
    style: {
      backgroundColor: timer.style.backgroundColor,
      textColor: timer.style.textColor,
      size: timer.style.size,
      position: timer.style.position,
    },
    urgency: { mode: timer.urgency.mode, thresholdMinutes: timer.urgency.thresholdMinutes },
    targeting: {
      scope,
      products: scope === "products" ? resources : [],
      collections: scope === "collections" ? resources : [],
    },
    impressions,
    createdAt: iso(timer.createdAt),
    updatedAt: iso(timer.updatedAt),
    ...(overlapsWith ? { overlapsWith } : {}),
  };
}
