import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import serveStatic from "serve-static";

import { createApp } from "./app.js";
import { config } from "./config.js";
import { connectDb } from "./db.js";
import PrivacyWebhookHandlers from "./privacy.js";
import { shopStateRepository } from "./repositories/shopState.js";
import { timersRepository } from "./repositories/timers.js";
import { createAdminClient } from "./services/adminClient.js";
import { createHintSync } from "./services/hintSync.js";
import { createShopify } from "./shopify.js";

const WEB_ROOT = fileURLToPath(new URL(".", import.meta.url));
const STATIC_PATH = join(WEB_ROOT, "frontend", config.isProduction ? "dist" : "");

let hintSync;
const shopify = createShopify({
  // Uninstalling erases the hint, so a new session rebuilds it. sync() never throws, which
  // matters because a failing hook would fail the request that triggered it.
  afterAuth: ({ session }) => hintSync.sync(session),
});

const admin = createAdminClient({
  createGraphqlClient: (session) => new shopify.api.clients.Graphql({ session }),
  deleteSession: (id) => shopify.config.sessionStorage.deleteSession(id),
});
hintSync = createHintSync({ admin, timers: timersRepository, shopState: shopStateRepository });

const app = createApp({
  authenticate: shopify.validateAuthenticatedSession(),
  proxySecret: config.apiSecret,
  hintSync,
  admin,
  beforeApi: (app) => {
    // The template's stubs stay as shipped. Webhooks are out of scope (specs/04-api.md).
    app.post(
      shopify.config.webhooks.path,
      shopify.processWebhooks({ webhookHandlers: PrivacyWebhookHandlers }),
    );
  },
  afterApi: (app) => {
    app.use(shopify.cspHeaders());
    app.use(serveStatic(STATIC_PATH, { index: false }));
    app.use(shopify.ensureInstalledOnShop(), (_req, res) => {
      const html = readFileSync(join(STATIC_PATH, "index.html"), "utf8");
      res
        .status(200)
        .set("Content-Type", "text/html")
        .send(html.replace("%VITE_SHOPIFY_API_KEY%", config.apiKey));
    });
  },
});

try {
  await connectDb();
} catch (error) {
  console.error(`Couldn't connect to MongoDB at ${config.mongo.url}: ${error.message}`);
  process.exit(1);
}

app.listen(config.port);
