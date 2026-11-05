// A-3 in specs/09-test-plan.md: GET /proxy/timers p95 under 200ms with 200 timers in one shop.
// Runs the real app, routes and MongoDB in a throwaway database. Only Shopify itself is stubbed.
import { once } from "node:events";
import mongoose from "mongoose";
import { createApp } from "../web/app.js";
import { computeProxySignature } from "../web/middleware/verifyProxy.js";
import { Timer } from "../web/models/Timer.js";
import { TimerStats } from "../web/models/TimerStats.js";

const MONGO_URL = process.env.MONGO_URL ?? "mongodb://127.0.0.1:27017";
const DATABASE = "countdown_timer_perf";
const SHOP = "perf-shop.myshopify.com";
const SECRET = "perf-secret";
const TIMERS = 200;
const WARMUP = 100;
const REQUESTS = 2000;
const CONCURRENCY = 10;
const LIMIT_MS = 200;

const HOUR = 3600 * 1000;
const productId = (i) => String(9000000 + i);
const collectionId = (i) => String(7000000 + i);

/** A mix like a busy shop: every scope, both types, and a third already expired. */
function seedTimers(now) {
  return Array.from({ length: TIMERS }, (_, i) => {
    const scope = ["all", "products", "collections"][i % 3];
    const evergreen = i % 4 === 0;
    const expired = !evergreen && i % 3 === 1;
    return {
      shop: SHOP,
      name: `Timer ${i}`,
      type: evergreen ? "evergreen" : "fixed",
      startAt: evergreen ? null : new Date(now - 2 * HOUR),
      endAt: evergreen ? null : new Date(now + (expired ? -HOUR : (i + 1) * HOUR)),
      durationMinutes: evergreen ? 45 : null,
      headline: "Offer ends in",
      description: "Limited time",
      style: { backgroundColor: "#111111", textColor: "#FFFFFF", size: "medium", position: "inline" },
      urgency: { mode: "none", thresholdMinutes: 5 },
      targeting: {
        scope,
        productIds: scope === "products" ? Array.from({ length: 50 }, (_, k) => productId((i + k) % 100)) : [],
        collectionIds: scope === "collections" ? Array.from({ length: 20 }, (_, k) => collectionId((i + k) % 40)) : [],
        labels: [],
      },
    };
  });
}

function signedPath(i) {
  const params = new URLSearchParams({
    productId: productId(i % 150), // Some products match no product-scoped timer.
    collectionIds: [collectionId(i % 50), collectionId((i + 7) % 50)].sort().join(","),
    shop: SHOP,
    logged_in_customer_id: "",
    path_prefix: "/apps/countdown",
    timestamp: String(Math.floor(Date.now() / 1000)),
  }).toString();
  return `/proxy/timers?${params}&signature=${computeProxySignature(params, SECRET)}`;
}

const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
const summary = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return { p50: percentile(sorted, 50), p95: percentile(sorted, 95), p99: percentile(sorted, 99), max: sorted.at(-1) };
};
const ms = (value) => `${value.toFixed(1)}ms`;

async function run() {
  mongoose.set("sanitizeFilter", true);
  await mongoose.connect(MONGO_URL, { dbName: DATABASE });
  if (mongoose.connection.name !== DATABASE) throw new Error("Not the perf database");
  await Promise.all([Timer.init(), TimerStats.init()]);
  await Timer.deleteMany({});
  await Timer.insertMany(seedTimers(Date.now()));

  const unused = () => {
    throw new Error("Not used by the storefront API");
  };
  const app = createApp({
    authenticate: unused,
    proxySecret: SECRET,
    hintSync: { sync: unused },
    admin: { request: unused },
    limits: { admin: 1, storefrontRead: 1e6, storefrontWrite: 1 },
  });

  // Server-side time: from the request reaching Node until the response is fully written.
  const serverTimes = [];
  const timed = (req, res) => {
    const start = process.hrtime.bigint();
    res.on("finish", () => serverTimes.push(Number(process.hrtime.bigint() - start) / 1e6));
    app(req, res);
  };
  const { createServer } = await import("node:http");
  const server = createServer(timed).listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;

  const statuses = new Map();
  let candidates = 0;
  const clientTimes = [];
  const hit = async (i, record) => {
    const start = performance.now();
    const response = await fetch(base + signedPath(i));
    const body = await response.json();
    if (!record) return;
    clientTimes.push(performance.now() - start);
    statuses.set(response.status, (statuses.get(response.status) ?? 0) + 1);
    candidates += body.timers?.length ?? 0;
  };

  for (let i = 0; i < WARMUP; i++) await hit(i, false);
  serverTimes.length = 0;

  let next = 0;
  const worker = async () => {
    while (next < REQUESTS) await hit(next++, true);
  };
  const started = performance.now();
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  const seconds = (performance.now() - started) / 1000;
  server.close();

  const server95 = summary(serverTimes);
  const client95 = summary(clientTimes);
  console.log(`GET /proxy/timers: ${REQUESTS} requests, ${CONCURRENCY} at a time, ${TIMERS} timers in one shop`);
  console.log(`Statuses: ${[...statuses].map(([s, n]) => `${s} x${n}`).join(", ")}; average candidates returned ${(candidates / REQUESTS).toFixed(2)}`);
  console.log(`Server-side: p50 ${ms(server95.p50)}, p95 ${ms(server95.p95)}, p99 ${ms(server95.p99)}, max ${ms(server95.max)}`);
  console.log(`With local HTTP: p50 ${ms(client95.p50)}, p95 ${ms(client95.p95)}, p99 ${ms(client95.p99)}, max ${ms(client95.max)}`);
  console.log(`Throughput: ${(REQUESTS / seconds).toFixed(0)} requests per second`);
  console.log("The dev tunnel and Shopify's proxy add latency outside the app, so they aren't included.");

  const passed = server95.p95 < LIMIT_MS && statuses.get(200) === REQUESTS;
  console.log(passed ? `PASS: p95 under ${LIMIT_MS}ms` : `FAIL: p95 must be under ${LIMIT_MS}ms, with every request a 200`);
  return passed;
}

let passed;
try {
  passed = await run();
} finally {
  if (mongoose.connection.name === DATABASE) await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}
process.exit(passed ? 0 : 1);
