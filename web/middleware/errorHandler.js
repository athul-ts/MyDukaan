import { sendError } from "../errors.js";

// Express identifies error handlers by their four parameters.
// eslint-disable-next-line no-unused-vars
export function errorHandler(error, _req, res, _next) {
  console.error(error);
  if (res.headersSent) return res.end();
  return sendError(res, 500, "INTERNAL", "Something went wrong");
}
