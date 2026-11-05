import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { computeProxySignature } from "../../web/middleware/verifyProxy.js";
import { TimerStats } from "../../web/models/TimerStats.js";
import {
  authed,
  clearTestDb,
  collectionTargeting,
  connectTestDb,
  createTestApp,
  disconnectTestDb,
  evergreenInput,
  fixedInput,
  PROXY_SECRET,
  productTargeting,
  SHOP_A,
  SHOP_B,
  signedPath,
} from "./helpers.js";

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
beforeEach(clearTestDb);

const minutesFromNow = (minutes) => new Date(Date.now() + minutes * 60000).toISOString();
const create = async (app, input, shop = SHOP_A) => {
  const response = await authed(request(app).post("/api/timers"), shop).send(input);
  expect(response.status).toBe(201);
  return response.body.timer;
};
const fetchTimers = (app, params, options) =>
  request(app).get(signedPath("/proxy/timers", { productId: "1", ...params }, options));

describe("T-5 proxy signature", () => {
  it("accepts a valid signature", async () => {
    const { app } = createTestApp();
    expect((await fetchTimers(app)).status).toBe(200);
  });

  it("rejects a tampered parameter", async () => {
    const { app } = createTestApp();
    const path = signedPath("/proxy/timers", { productId: "1" }).replace("productId=1", "productId=2");
    const response = await request(app).get(path);
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects a tampered shop, so one shop can't read another's data", async () => {
    const { app } = createTestApp();
    await create(app, fixedInput(), SHOP_B);
    const path = signedPath("/proxy/timers", { productId: "1" }).replace(SHOP_A, SHOP_B);
    expect((await request(app).get(path)).status).toBe(401);
  });

  it("rejects the wrong secret, and a missing signature", async () => {
    const { app } = createTestApp();
    expect((await fetchTimers(app, {}, { secret: "wrong" })).status).toBe(401);
    expect((await request(app).get(`/proxy/timers?productId=1&shop=${SHOP_A}`)).status).toBe(401);
  });

  it("joins a repeated parameter with a comma", () => {
    const repeated = "ids=1&ids=2&shop=x.myshopify.com";
    const joined = "ids=1,2&shop=x.myshopify.com";
    expect(computeProxySignature(repeated, PROXY_SECRET)).toBe(computeProxySignature(joined, PROXY_SECRET));
  });

  it("signs decoded values", () => {
    const encoded = "path_prefix=%2Fapps%2Fcountdown&shop=x.myshopify.com";
    const decoded = "path_prefix=/apps/countdown&shop=x.myshopify.com";
    expect(computeProxySignature(encoded, PROXY_SECRET)).toBe(computeProxySignature(decoded, PROXY_SECRET));
  });

  it("rejects a validly signed shop that isn't a myshopify domain", async () => {
    const { app } = createTestApp();
    const response = await fetchTimers(app, {}, { shop: "evil.example.com" });
    expect(response.status).toBe(401);
  });

  it("protects every proxy route", async () => {
    const { app } = createTestApp();
    expect((await request(app).post("/proxy/impressions").send("{}")).status).toBe(401);
    expect((await request(app).get("/proxy/anything")).status).toBe(401);
    expect((await request(app).get(signedPath("/proxy/anything"))).status).toBe(404);
  });
});

describe("T-7 public serializer", () => {
  it("returns exactly the allowlisted keys", async () => {
    const { app } = createTestApp();
    await create(app, fixedInput({ name: "SECRET NAME", targeting: productTargeting(1) }));
    const { body } = await fetchTimers(app);
    expect(Object.keys(body)).toEqual(["timers"]);
    expect(Object.keys(body.timers[0]).sort()).toEqual(
      ["description", "durationMinutes", "endAt", "headline", "id", "startAt", "style", "type", "urgency"].sort(),
    );
    expect(Object.keys(body.timers[0].style).sort()).toEqual(["backgroundColor", "position", "size", "textColor"]);
    expect(Object.keys(body.timers[0].urgency).sort()).toEqual(["mode", "thresholdMinutes"]);
    expect(JSON.stringify(body)).not.toContain("SECRET NAME");
    expect(JSON.stringify(body)).not.toContain(SHOP_A);
  });
});

describe("T-10 candidates", () => {
  it("matches by all, product and collection scope, and nothing else", async () => {
    const { app } = createTestApp();
    await create(app, fixedInput({ name: "product", headline: "p", targeting: productTargeting(1) }));
    await create(app, fixedInput({ name: "collection", headline: "c", targeting: collectionTargeting(5) }));
    const headlines = async (params) =>
      (await fetchTimers(app, params)).body.timers.map((timer) => timer.headline);
    expect(await headlines({ productId: "1" })).toEqual(["p"]);
    expect(await headlines({ productId: "2", collectionIds: "5,6" })).toEqual(["c"]);
    expect(await headlines({ productId: "2", collectionIds: "6" })).toEqual([]);
    await create(app, fixedInput({ name: "all", headline: "a" }));
    expect(await headlines({ productId: "2" })).toEqual(["a"]);
  });

  it("doesn't match part of a product ID", async () => {
    const { app } = createTestApp();
    await create(app, fixedInput({ targeting: productTargeting(123) }));
    expect((await fetchTimers(app, { productId: "12" })).body.timers).toEqual([]);
  });

  it("excludes expired timers and timers beyond the lead-in, and includes those within it", async () => {
    const { app } = createTestApp();
    const { Timer } = await import("../../web/models/Timer.js");
    const expired = await create(app, fixedInput({ headline: "expired" }));
    await Timer.updateOne(
      { _id: expired.id },
      { $set: { startAt: new Date(Date.now() - 7200000), endAt: new Date(Date.now() - 1000) } },
    );
    await create(app, fixedInput({ headline: "far", startAt: minutesFromNow(6), endAt: minutesFromNow(60) }));
    await create(app, fixedInput({ headline: "near", startAt: minutesFromNow(4), endAt: minutesFromNow(60) }));
    await create(app, evergreenInput({ headline: "ever" }));
    const { body } = await fetchTimers(app);
    expect(body.timers.map((timer) => timer.headline)).toEqual(["near", "ever"]);
  });

  it("returns up to 3 in rank order, always including a live timer", async () => {
    const { app } = createTestApp();
    await create(app, fixedInput({ headline: "live", targeting: { scope: "all", products: [], collections: [] } }));
    for (const headline of ["soon1", "soon2", "soon3"]) {
      await create(app, fixedInput({ headline, startAt: minutesFromNow(2), endAt: minutesFromNow(30), targeting: productTargeting(1) }));
    }
    const { body } = await fetchTimers(app);
    expect(body.timers).toHaveLength(3);
    expect(body.timers.map((timer) => timer.headline)).toContain("live");
    expect(body.timers.at(-1).headline).toBe("live");
  });

  it("returns an empty list when nothing matches", async () => {
    const { app } = createTestApp();
    const response = await fetchTimers(app);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ timers: [] });
  });

  it("never returns another shop's timers", async () => {
    const { app } = createTestApp();
    await create(app, fixedInput(), SHOP_B);
    expect((await fetchTimers(app)).body.timers).toEqual([]);
    expect((await fetchTimers(app, {}, { shop: SHOP_B })).body.timers).toHaveLength(1);
  });

  it("returns 400 for invalid IDs, including over 50 collections", async () => {
    const { app } = createTestApp();
    for (const params of [
      { productId: "abc" },
      { productId: "" },
      { collectionIds: "1,x" },
      { collectionIds: Array.from({ length: 51 }, (_, i) => i).join(",") },
    ]) {
      const response = await fetchTimers(app, params);
      expect(response.status).toBe(400);
      expect(response.headers["cache-control"]).toBe("no-store");
    }
  });

  it("treats an empty collection list as none", async () => {
    const { app } = createTestApp();
    expect((await fetchTimers(app, { collectionIds: "" })).status).toBe(200);
  });
});

describe("T-9 caching", () => {
  it("sets the public cache header and an ETag, and answers 304", async () => {
    const { app } = createTestApp();
    await create(app, fixedInput());
    const first = await fetchTimers(app);
    expect(first.headers["cache-control"]).toBe("public, max-age=30, stale-while-revalidate=120");
    expect(first.headers.etag).toBeDefined();
    const second = await fetchTimers(app).set("if-none-match", first.headers.etag);
    expect(second.status).toBe(304);
  });

  it("doesn't cache errors", async () => {
    const { app } = createTestApp();
    const response = await request(app).get(`/proxy/timers?shop=${SHOP_A}`);
    expect(response.headers["cache-control"]).toBe("no-store");
  });
});

describe("T-14 impressions", () => {
  const post = (app, body, { shop, contentType = "text/plain;charset=UTF-8" } = {}) =>
    request(app)
      .post(signedPath("/proxy/impressions", {}, shop ? { shop } : {}))
      .set("content-type", contentType)
      .send(body);
  const count = async (id) => (await TimerStats.findOne({ timerId: id }).lean())?.impressions ?? 0;

  it("creates the count on the first impression and increments after that", async () => {
    const { app } = createTestApp();
    const timer = await create(app, fixedInput());
    const response = await post(app, JSON.stringify({ timerId: timer.id }));
    expect(response.status).toBe(202);
    expect(response.text).toBe("");
    expect(await count(timer.id)).toBe(1);
    await post(app, JSON.stringify({ timerId: timer.id }));
    expect(await count(timer.id)).toBe(2);
  });

  it("accepts JSON as well as the text/plain that sendBeacon sends", async () => {
    const { app } = createTestApp();
    const timer = await create(app, fixedInput());
    const response = await post(app, JSON.stringify({ timerId: timer.id }), { contentType: "application/json" });
    expect(response.status).toBe(202);
    expect(await count(timer.id)).toBe(1);
  });

  it("counts correctly when first impressions race", async () => {
    const { app } = createTestApp();
    const timer = await create(app, fixedInput());
    await Promise.all(Array.from({ length: 8 }, () => post(app, JSON.stringify({ timerId: timer.id }))));
    expect(await count(timer.id)).toBe(8);
  });

  it("returns 404 for an unknown, malformed or non-string ID", async () => {
    const { app } = createTestApp();
    for (const timerId of ["665f0c000000000000000000", "not-an-id", { $gt: "" }, 7, null]) {
      expect((await post(app, JSON.stringify({ timerId }))).status).toBe(404);
    }
    expect(await TimerStats.countDocuments({})).toBe(0);
  });

  it("returns 400 for malformed JSON", async () => {
    const { app } = createTestApp();
    expect((await post(app, "{not json")).status).toBe(400);
  });

  it("T-6 can't count against another shop's timer", async () => {
    const { app } = createTestApp();
    const timer = await create(app, fixedInput());
    const response = await post(app, JSON.stringify({ timerId: timer.id }), { shop: SHOP_B });
    expect(response.status).toBe(404);
    expect(await count(timer.id)).toBe(0);
  });
});

describe("T-9 storefront rate limit", () => {
  it("returns 429 with Retry-After, per shop", async () => {
    const { app } = createTestApp({ limits: { admin: 100, storefrontRead: 1, storefrontWrite: 100 } });
    expect((await fetchTimers(app)).status).toBe(200);
    const blocked = await fetchTimers(app);
    expect(blocked.status).toBe(429);
    expect(blocked.headers["retry-after"]).toBeDefined();
    expect((await fetchTimers(app, {}, { shop: SHOP_B })).status).toBe(200);
  });
});
