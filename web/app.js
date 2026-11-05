import compression from "compression";
import express from "express";
import helmet from "helmet";
import { sendError } from "./errors.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { shopRateLimit } from "./middleware/rateLimits.js";
import { requireSessionToken } from "./middleware/requireSessionToken.js";
import { verifyProxy } from "./middleware/verifyProxy.js";
import { shopStateRepository } from "./repositories/shopState.js";
import { statsRepository } from "./repositories/stats.js";
import { timersRepository } from "./repositories/timers.js";
import { createAdminRouter } from "./routes/admin.js";
import { createStorefrontRouter } from "./routes/storefront.js";

export const DEFAULT_LIMITS = { admin: 120, storefrontRead: 3000, storefrontWrite: 3000 };

/**
 * Everything is passed in, so tests can run the real routes and database without Shopify.
 * `beforeApi` and `afterApi` let index.js add webhooks and the admin page around the API.
 */
export function createApp({
  authenticate,
  proxySecret,
  hintSync,
  admin,
  limits = DEFAULT_LIMITS,
  beforeApi = () => {},
  afterApi = () => {},
}) {
  const repositories = {
    timers: timersRepository,
    stats: statsRepository,
    shopState: shopStateRepository,
  };

  const app = express();

  // helmet's default CSP and frame options would stop the app loading in the admin iframe.
  // shopify.cspHeaders() sets frame-ancestors for each shop instead. See specs/07-nfr-security.md.
  app.use(helmet({ contentSecurityPolicy: false, frameguard: false }));
  app.use(compression());

  // Reached through the Shopify app proxy, so the signature is checked before anything else.
  const verifiedShop = (res) => res.locals.shop;
  const storefront = createStorefrontRouter(repositories);
  app.use("/proxy", verifyProxy(proxySecret));
  app.get("/proxy/timers", shopRateLimit(limits.storefrontRead, verifiedShop));
  app.post("/proxy/impressions", shopRateLimit(limits.storefrontWrite, verifiedShop));
  app.use("/proxy", storefront);
  app.use("/proxy", (_req, res) => sendError(res, 404, "NOT_FOUND", "Not found"));

  beforeApi(app);

  // Any new route outside /api or /proxy also needs a proxy rule in web/frontend/vite.config.js.
  app.use("/api", requireSessionToken, authenticate);
  app.use("/api", shopRateLimit(limits.admin, (res) => res.locals.shopify.session.shop));
  app.use("/api", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.use("/api", express.json({ limit: "100kb" }));
  app.use("/api", createAdminRouter({ ...repositories, hintSync, admin }));
  app.use("/api", (_req, res) => sendError(res, 404, "NOT_FOUND", "Not found"));

  afterApi(app);

  app.use(errorHandler);
  return app;
}
