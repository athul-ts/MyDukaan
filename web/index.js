import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import compression from "compression";
import express from "express";
import helmet from "helmet";
import serveStatic from "serve-static";

import { config } from "./config.js";
import { connectDb } from "./db.js";
import { sendError } from "./errors.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requireSessionToken } from "./middleware/requireSessionToken.js";
import PrivacyWebhookHandlers from "./privacy.js";
import shopify from "./shopify.js";

const WEB_ROOT = fileURLToPath(new URL(".", import.meta.url));
const STATIC_PATH = join(WEB_ROOT, "frontend", config.isProduction ? "dist" : "");

const app = express();

// helmet's default CSP and frame options would stop the app loading in the admin iframe.
// shopify.cspHeaders() sets frame-ancestors for each shop instead. See specs/07-nfr-security.md.
app.use(helmet({ contentSecurityPolicy: false, frameguard: false }));
app.use(compression());

// The template's stubs stay as shipped. Webhooks are out of scope (specs/04-api.md).
app.post(
  shopify.config.webhooks.path,
  shopify.processWebhooks({ webhookHandlers: PrivacyWebhookHandlers }),
);

// Any new route outside /api also needs a proxy rule in web/frontend/vite.config.js.
app.use("/api", requireSessionToken, shopify.validateAuthenticatedSession());
app.use("/api", express.json({ limit: "100kb" }));
app.use("/api", (_req, res) => sendError(res, 404, "NOT_FOUND", "Not found"));

app.use(shopify.cspHeaders());
app.use(serveStatic(STATIC_PATH, { index: false }));

app.use(shopify.ensureInstalledOnShop(), (_req, res) => {
  const html = readFileSync(join(STATIC_PATH, "index.html"), "utf8");
  res
    .status(200)
    .set("Content-Type", "text/html")
    .send(html.replace("%VITE_SHOPIFY_API_KEY%", config.apiKey));
});

app.use(errorHandler);

try {
  await connectDb();
} catch (error) {
  console.error(`Couldn't connect to MongoDB at ${config.mongo.url}: ${error.message}`);
  process.exit(1);
}

app.listen(config.port);
