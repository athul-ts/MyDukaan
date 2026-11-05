/** Sends the error shape from specs/04-api.md. Errors are never cached. */
export function sendError(res, status, code, message, details) {
  res.set("Cache-Control", "no-store");
  return res.status(status).json({
    error: { code, message, ...(details ? { details } : {}) },
  });
}
