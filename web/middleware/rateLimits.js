import { rateLimit } from "express-rate-limit";
import { sendError } from "../errors.js";

/**
 * In-memory, which suits a single instance. Limits are per verified shop, as S3 found no
 * documented way to trust a visitor's IP through the proxy. See specs/04-api.md.
 */
export function shopRateLimit(perMinute, shopOf) {
  return rateLimit({
    windowMs: 60 * 1000,
    limit: perMinute,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: (_req, res) => shopOf(res),
    validate: { xForwardedForHeader: false, trustProxy: false },
    handler: (_req, res) => sendError(res, 429, "RATE_LIMITED", "Too many requests"),
  });
}
