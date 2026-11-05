import { sendError } from "../errors.js";
import { AdminAuthError } from "../services/adminClient.js";

export function errorHandler(error, _req, res, _next) {
  if (res.headersSent) return res.end();
  if (error instanceof AdminAuthError) {
    res.set("X-Shopify-Retry-Invalid-Session-Request", "1");
    return sendError(res, 401, "UNAUTHORIZED", error.message);
  }
  if (error.type === "entity.parse.failed" || error.type === "entity.too.large") {
    return sendError(res, 400, "BAD_REQUEST", "The request body couldn't be read");
  }
  console.error(error);
  return sendError(res, 500, "INTERNAL", "Something went wrong");
}
