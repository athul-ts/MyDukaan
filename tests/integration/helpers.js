import mongoose from "mongoose";
import { createApp, DEFAULT_LIMITS } from "../../web/app.js";
import { computeProxySignature } from "../../web/middleware/verifyProxy.js";
import { Timer } from "../../web/models/Timer.js";
import { TimerStats } from "../../web/models/TimerStats.js";
import { ShopState } from "../../web/models/ShopState.js";
import { shopStateRepository } from "../../web/repositories/shopState.js";
import { timersRepository } from "../../web/repositories/timers.js";
import { createAdminClient } from "../../web/services/adminClient.js";
import { createHintSync } from "../../web/services/hintSync.js";

export const SHOP_A = "shop-a.myshopify.com";
export const SHOP_B = "shop-b.myshopify.com";
export const PROXY_SECRET = "test-secret";
const TEST_DATABASE = "countdown_timer_test";

export async function connectTestDb() {
  mongoose.set("sanitizeFilter", true);
  await mongoose.connect("mongodb://127.0.0.1:27017", { dbName: TEST_DATABASE });
  await Promise.all([Timer.init(), TimerStats.init(), ShopState.init()]);
}

export async function clearTestDb() {
  await Promise.all([Timer.deleteMany({}), TimerStats.deleteMany({}), ShopState.deleteMany({})]);
}

export async function disconnectTestDb() {
  if (mongoose.connection.name !== TEST_DATABASE) throw new Error("Not the test database");
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}

/** Stands in for Shopify's Admin API, recording what the app writes. */
export function fakeShopify({ failWith } = {}) {
  const state = { writes: [], deletedSessions: [], failWith };
  const graphqlClient = {
    async request(query, { variables } = {}) {
      if (state.failWith) throw state.failWith;
      if (query.includes("currentAppInstallation")) {
        return { data: { currentAppInstallation: { id: "gid://shopify/AppInstallation/1" } } };
      }
      if (query.includes("metafieldsSet")) {
        state.writes.push(variables.metafields[0]);
        return { data: { metafieldsSet: { userErrors: [] } } };
      }
      return {
        data: { shop: { ianaTimezone: "Asia/Kolkata", myshopifyDomain: "shop-a.myshopify.com" } },
      };
    },
  };
  const admin = createAdminClient({
    createGraphqlClient: () => graphqlClient,
    deleteSession: async (id) => state.deletedSessions.push(id),
  });
  return { state, admin };
}

/** Runs the real routes and database. Only Shopify auth and the Admin API are faked. */
export function createTestApp({ shopify = fakeShopify(), limits = DEFAULT_LIMITS } = {}) {
  const hintSync = createHintSync({
    admin: shopify.admin,
    timers: timersRepository,
    shopState: shopStateRepository,
  });
  const app = createApp({
    authenticate: (req, res, next) => {
      const shop = req.headers["x-test-shop"] ?? SHOP_A;
      res.locals.shopify = { session: { id: `offline_${shop}`, shop } };
      next();
    },
    proxySecret: PROXY_SECRET,
    hintSync,
    admin: shopify.admin,
    limits,
  });
  return { app, shopify, hintSync };
}

/** Builds a path signed the way Shopify's app proxy signs it. */
export function signedPath(path, params = {}, { shop = SHOP_A, secret = PROXY_SECRET } = {}) {
  const query = new URLSearchParams({
    ...params,
    shop,
    logged_in_customer_id: "",
    path_prefix: "/apps/countdown",
    timestamp: "1793860000",
  }).toString();
  return `${path}?${query}&signature=${computeProxySignature(query, secret)}`;
}

export const authed = (request, shop = SHOP_A) => request.set("authorization", "Bearer test").set("x-test-shop", shop);

export const fixedInput = (overrides = {}) => ({
  name: "Black Friday",
  type: "fixed",
  startAt: new Date(Date.now() - 3600000).toISOString(),
  endAt: new Date(Date.now() + 3600000).toISOString(),
  headline: "Ends soon",
  description: "50% off",
  style: { backgroundColor: "#111111", textColor: "#FFFFFF", size: "medium", position: "inline" },
  urgency: { mode: "color_pulse", thresholdMinutes: 5 },
  targeting: { scope: "all", products: [], collections: [] },
  ...overrides,
});

export const evergreenInput = (overrides = {}) => {
  const { startAt: _s, endAt: _e, ...rest } = fixedInput();
  return { ...rest, type: "evergreen", durationMinutes: 45, ...overrides };
};

export const productTargeting = (...ids) => ({
  scope: "products",
  products: ids.map((id) => ({ id: `gid://shopify/Product/${id}`, title: `Product ${id}` })),
  collections: [],
});

export const collectionTargeting = (...ids) => ({
  scope: "collections",
  products: [],
  collections: ids.map((id) => ({ id: `gid://shopify/Collection/${id}`, title: `Collection ${id}` })),
});
