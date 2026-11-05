import { sendError } from "../errors.js";

/**
 * With no token, the Shopify library returns App Bridge HTML with a 200, which suits page
 * loads but not API calls. The API must return 401 (S1 in specs/10-spikes.md).
 */
export function requireSessionToken(req, res, next) {
  if (req.headers.authorization) return next();
  return sendError(res, 401, "UNAUTHORIZED", "Missing session token");
}
