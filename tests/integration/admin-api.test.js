import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  authed,
  clearTestDb,
  connectTestDb,
  createTestApp,
  disconnectTestDb,
  evergreenInput,
  fakeShopify,
  fixedInput,
  productTargeting,
  SHOP_A,
  SHOP_B,
  signedPath,
} from "./helpers.js";

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
beforeEach(clearTestDb);

const hourFromNow = (hours) => new Date(Date.now() + hours * 3600000).toISOString();
const create = async (app, input, shop = SHOP_A) => {
  const response = await authed(request(app).post("/api/timers"), shop).send(input);
  expect(response.status).toBe(201);
  return response.body.timer;
};

describe("T-9 create and read", () => {
  it("creates a timer with derived status, and targeting in the API's shape", async () => {
    const { app } = createTestApp();
    const timer = await create(app, fixedInput({ targeting: productTargeting(123) }));
    expect(timer.status).toBe("active");
    expect(timer.impressions).toBe(0);
    expect(timer.targeting.products).toEqual([{ id: "gid://shopify/Product/123", title: "Product 123" }]);

    const read = await authed(request(app).get(`/api/timers/${timer.id}`));
    expect(read.status).toBe(200);
    expect(read.body.timer.id).toBe(timer.id);
    expect(read.headers["cache-control"]).toBe("no-store");
  });

  it("derives scheduled and expired status", async () => {
    const { app } = createTestApp();
    const scheduled = await create(app, fixedInput({ startAt: hourFromNow(1), endAt: hourFromNow(2) }));
    expect(scheduled.status).toBe("scheduled");
    const evergreen = await create(app, evergreenInput());
    expect(evergreen.status).toBe("active");
    expect(evergreen.startAt).toBeNull();
  });

  it("returns 422 with field details for invalid input", async () => {
    const { app } = createTestApp();
    const response = await authed(request(app).post("/api/timers")).send(fixedInput({ name: "" }));
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("VALIDATION_FAILED");
    expect(response.body.error.details[0].path).toBe("name");
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it("returns 422 for an end in the past on create", async () => {
    const { app } = createTestApp();
    const response = await authed(request(app).post("/api/timers")).send(
      fixedInput({ startAt: hourFromNow(-2), endAt: hourFromNow(-1) }),
    );
    expect(response.status).toBe(422);
    expect(response.body.error.details[0].path).toBe("endAt");
  });

  it("returns 400 for malformed JSON", async () => {
    const { app } = createTestApp();
    const response = await authed(request(app).post("/api/timers"))
      .set("content-type", "application/json")
      .send("{not json");
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("BAD_REQUEST");
  });

  it("returns 404 for a missing or malformed ID, and for unknown routes", async () => {
    const { app } = createTestApp();
    for (const path of ["/api/timers/665f0c000000000000000000", "/api/timers/not-an-id", "/api/nope"]) {
      const response = await authed(request(app).get(path));
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("NOT_FOUND");
    }
  });

  it("returns 401 without a session token", async () => {
    const { app } = createTestApp();
    const response = await request(app).get("/api/timers");
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
    expect(response.headers["cache-control"]).toBe("no-store");
  });
});

describe("T-9 list", () => {
  it("filters by derived status, in the database", async () => {
    const { app } = createTestApp();
    await create(app, fixedInput({ name: "Live" }));
    await create(app, evergreenInput({ name: "Ever" }));
    await create(app, fixedInput({ name: "Later", startAt: hourFromNow(1), endAt: hourFromNow(2) }));
    const names = async (status) => {
      const response = await authed(request(app).get(`/api/timers?status=${status}`));
      return response.body.timers.map((timer) => timer.name).sort();
    };
    expect(await names("active")).toEqual(["Ever", "Live"]);
    expect(await names("scheduled")).toEqual(["Later"]);
    expect(await names("expired")).toEqual([]);
  });

  it("searches names case-insensitively, treating regex characters as text", async () => {
    const { app } = createTestApp();
    await create(app, fixedInput({ name: "Flash (Sale)" }));
    await create(app, fixedInput({ name: "Other" }));
    const search = async (q) => {
      const response = await authed(request(app).get(`/api/timers?q=${encodeURIComponent(q)}`));
      expect(response.status).toBe(200);
      return response.body.timers.map((timer) => timer.name);
    };
    expect(await search("flash")).toEqual(["Flash (Sale)"]);
    expect(await search("(sale)")).toEqual(["Flash (Sale)"]);
    expect(await search(".*")).toEqual([]);
  });

  it("sorts by end time with evergreen last, and by name", async () => {
    const { app } = createTestApp();
    await create(app, evergreenInput({ name: "A Ever" }));
    await create(app, fixedInput({ name: "C Later", endAt: hourFromNow(3) }));
    await create(app, fixedInput({ name: "B Soon", endAt: hourFromNow(1) }));
    const sorted = async (sort) => {
      const response = await authed(request(app).get(`/api/timers?sort=${sort}`));
      return response.body.timers.map((timer) => timer.name);
    };
    expect(await sorted("endAt_asc")).toEqual(["B Soon", "C Later", "A Ever"]);
    expect(await sorted("name_asc")).toEqual(["A Ever", "B Soon", "C Later"]);
  });

  it("pages results, and reports the total", async () => {
    const { app } = createTestApp();
    for (const name of ["a", "b", "c"]) await create(app, fixedInput({ name }));
    const response = await authed(request(app).get("/api/timers?pageSize=2&page=2"));
    expect(response.body).toMatchObject({ page: 2, pageSize: 2, total: 3 });
    expect(response.body.timers).toHaveLength(1);
  });

  it("returns 400 for invalid query parameters", async () => {
    const { app } = createTestApp();
    for (const query of ["status=paused", "pageSize=51", "page=0", "sort=bad"]) {
      const response = await authed(request(app).get(`/api/timers?${query}`));
      expect(response.status).toBe(400);
    }
  });

  it("reports impressions and overlaps on each timer", async () => {
    const { app } = createTestApp();
    const a = await create(app, fixedInput({ name: "A" }));
    const b = await create(app, fixedInput({ name: "B" }));
    await request(app).post(signedPath("/proxy/impressions")).send(JSON.stringify({ timerId: a.id }));
    const { body } = await authed(request(app).get("/api/timers?sort=name_asc"));
    expect(body.timers[0].impressions).toBe(1);
    expect(body.timers[0].overlapsWith).toEqual([b.id]);
    expect(body.timers[1].impressions).toBe(0);
  });

  it("enforces the limit of 200 timers per shop", async () => {
    const { app } = createTestApp();
    const { Timer } = await import("../../web/models/Timer.js");
    const { toDocument } = await import("../../web/repositories/timers.js");
    const { timerInputSchema } = await import("../../shared/validation.js");
    const document = toDocument(timerInputSchema.parse(fixedInput()));
    await Timer.insertMany(Array.from({ length: 200 }, () => ({ ...document, shop: SHOP_A })));
    const blocked = await authed(request(app).post("/api/timers")).send(fixedInput());
    expect(blocked.status).toBe(422);
    const otherShop = await authed(request(app).post("/api/timers"), SHOP_B).send(fixedInput());
    expect(otherShop.status).toBe(201);
  });
});

describe("T-9 update and delete", () => {
  it("replaces a timer, keeping its creation time and impressions", async () => {
    const { app } = createTestApp();
    const timer = await create(app, fixedInput());
    await request(app).post(signedPath("/proxy/impressions")).send(JSON.stringify({ timerId: timer.id }));
    const response = await authed(request(app).put(`/api/timers/${timer.id}`)).send(
      fixedInput({ name: "Renamed", startAt: timer.startAt, endAt: timer.endAt }),
    );
    expect(response.status).toBe(200);
    expect(response.body.timer.name).toBe("Renamed");
    expect(response.body.timer.createdAt).toBe(timer.createdAt);
    expect(response.body.timer.impressions).toBe(1);
  });

  it("lets an expired timer be edited, but only given a future end if dates change", async () => {
    const { app } = createTestApp();
    const { Timer } = await import("../../web/models/Timer.js");
    const timer = await create(app, fixedInput());
    const past = { startAt: new Date(Date.now() - 7200000), endAt: new Date(Date.now() - 3600000) };
    await Timer.updateOne({ _id: timer.id }, { $set: past });
    const dates = { startAt: past.startAt.toISOString(), endAt: past.endAt.toISOString() };

    const rename = await authed(request(app).put(`/api/timers/${timer.id}`)).send(fixedInput({ name: "New", ...dates }));
    expect(rename.status).toBe(200);
    expect(rename.body.timer.status).toBe("expired");

    const pastEnd = await authed(request(app).put(`/api/timers/${timer.id}`)).send(
      fixedInput({ ...dates, endAt: new Date(Date.now() - 1000).toISOString() }),
    );
    expect(pastEnd.status).toBe(422);

    const revived = await authed(request(app).put(`/api/timers/${timer.id}`)).send(fixedInput({ ...dates, endAt: hourFromNow(1) }));
    expect(revived.body.timer.status).toBe("active");
  });

  it("clears the other type's fields when the type changes", async () => {
    const { app } = createTestApp();
    const timer = await create(app, fixedInput());
    const response = await authed(request(app).put(`/api/timers/${timer.id}`)).send(evergreenInput());
    expect(response.body.timer.startAt).toBeNull();
    expect(response.body.timer.durationMinutes).toBe(45);
  });

  it("deletes a timer along with its stats", async () => {
    const { app } = createTestApp();
    const { TimerStats } = await import("../../web/models/TimerStats.js");
    const timer = await create(app, fixedInput());
    await request(app).post(signedPath("/proxy/impressions")).send(JSON.stringify({ timerId: timer.id }));
    expect(await TimerStats.countDocuments({})).toBe(1);

    const response = await authed(request(app).delete(`/api/timers/${timer.id}`));
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ deleted: true, hintSync: "ok" });
    expect(await TimerStats.countDocuments({})).toBe(0);
    expect((await authed(request(app).get(`/api/timers/${timer.id}`))).status).toBe(404);
  });
});

describe("T-6 tenant isolation", () => {
  it("gives another shop 404 on read, update and delete", async () => {
    const { app } = createTestApp();
    const timer = await create(app, fixedInput());
    const path = `/api/timers/${timer.id}`;
    expect((await authed(request(app).get(path), SHOP_B)).status).toBe(404);
    expect((await authed(request(app).put(path), SHOP_B).send(fixedInput())).status).toBe(404);
    expect((await authed(request(app).delete(path), SHOP_B)).status).toBe(404);
    expect((await authed(request(app).get(path), SHOP_A)).status).toBe(200);
  });

  it("excludes other shops' timers from lists and overlaps", async () => {
    const { app } = createTestApp();
    await create(app, fixedInput());
    await create(app, fixedInput(), SHOP_B);
    const { body } = await authed(request(app).get("/api/timers"), SHOP_B);
    expect(body.total).toBe(1);
    expect(body.timers[0].overlapsWith).toEqual([]);
  });

  it("ignores a shop supplied in the body or query", async () => {
    const { app } = createTestApp();
    const inBody = await authed(request(app).post("/api/timers")).send({ ...fixedInput(), shop: SHOP_B });
    expect(inBody.status).toBe(422);
    await create(app, fixedInput());
    const { body } = await authed(request(app).get(`/api/timers?shop=${SHOP_B}`), SHOP_A);
    expect(body.total).toBe(1);
  });
});

describe("T-12 hint sync", () => {
  it("writes the rebuilt hint on create, update and delete", async () => {
    const shopify = fakeShopify();
    const { app } = createTestApp({ shopify });
    const timer = await create(app, fixedInput({ targeting: productTargeting(7) }));
    let hint = JSON.parse(shopify.state.writes.at(-1).value);
    expect(hint.t).toHaveLength(1);
    expect(hint.t[0].p).toBe("|7|");
    expect(shopify.state.writes.at(-1)).toMatchObject({ namespace: "countdown", key: "timer_hint", type: "json" });

    await authed(request(app).put(`/api/timers/${timer.id}`)).send(
      fixedInput({ startAt: timer.startAt, endAt: timer.endAt, targeting: productTargeting(8) }),
    );
    hint = JSON.parse(shopify.state.writes.at(-1).value);
    expect(hint.t[0].p).toBe("|8|");

    await authed(request(app).delete(`/api/timers/${timer.id}`));
    expect(JSON.parse(shopify.state.writes.at(-1).value).t).toEqual([]);
  });

  it("still saves the timer when sync fails, and keeps reporting it until a sync succeeds", async () => {
    const shopify = fakeShopify({ failWith: new Error("Shopify is down") });
    const { app } = createTestApp({ shopify });

    const created = await authed(request(app).post("/api/timers")).send(fixedInput());
    expect(created.status).toBe(201);
    expect(created.body.hintSync).toBe("failed");

    const list = await authed(request(app).get("/api/timers"));
    expect(list.body.total).toBe(1);
    expect(list.body.hintSync).toBe("failed");

    const stillDown = await authed(request(app).post("/api/hint/sync"));
    expect(stillDown.body.hintSync).toBe("failed");

    shopify.state.failWith = null;
    const retried = await authed(request(app).post("/api/hint/sync"));
    expect(retried.body.hintSync).toBe("ok");
    expect((await authed(request(app).get("/api/timers"))).body.hintSync).toBe("ok");
    expect(JSON.parse(shopify.state.writes.at(-1).value).t).toHaveLength(1);
  });

  it("keeps concurrent saves in order, so the last hint holds every timer", async () => {
    const shopify = fakeShopify();
    const { app } = createTestApp({ shopify });
    await Promise.all(
      Array.from({ length: 5 }, () => authed(request(app).post("/api/timers")).send(fixedInput())),
    );
    expect(JSON.parse(shopify.state.writes.at(-1).value).t).toHaveLength(5);
  });

  it("keeps one shop's hint apart from another's", async () => {
    const shopify = fakeShopify();
    const { app } = createTestApp({ shopify });
    await create(app, fixedInput());
    await create(app, fixedInput(), SHOP_B);
    expect(JSON.parse(shopify.state.writes.at(-1).value).t).toHaveLength(1);
  });
});

describe("T-15 stale session", () => {
  const unauthorized = Object.assign(new Error("Unauthorized"), { response: { code: 401 } });

  it("deletes the session and asks App Bridge to retry on a read", async () => {
    const shopify = fakeShopify({ failWith: unauthorized });
    const { app } = createTestApp({ shopify });
    const response = await authed(request(app).get("/api/shop"));
    expect(response.status).toBe(401);
    expect(response.headers["x-shopify-retry-invalid-session-request"]).toBe("1");
    expect(response.body.error.code).toBe("UNAUTHORIZED");
    expect(shopify.state.deletedSessions).toEqual([`offline_${SHOP_A}`]);
  });

  it("does the same for a manual hint sync, which is safe to retry", async () => {
    const shopify = fakeShopify({ failWith: unauthorized });
    const { app } = createTestApp({ shopify });
    const response = await authed(request(app).post("/api/hint/sync"));
    expect(response.status).toBe(401);
    expect(response.headers["x-shopify-retry-invalid-session-request"]).toBe("1");
  });

  it("doesn't ask to retry a save, as that would create a duplicate", async () => {
    const shopify = fakeShopify({ failWith: unauthorized });
    const { app } = createTestApp({ shopify });
    const response = await authed(request(app).post("/api/timers")).send(fixedInput());
    expect(response.status).toBe(201);
    expect(response.body.hintSync).toBe("failed");
    expect(response.headers["x-shopify-retry-invalid-session-request"]).toBeUndefined();
    expect(shopify.state.deletedSessions).toEqual([`offline_${SHOP_A}`]);
  });

  it("rebuilds the hint from MongoDB when a new session arrives", async () => {
    const shopify = fakeShopify();
    const { app, hintSync } = createTestApp({ shopify });
    await create(app, fixedInput());
    shopify.state.writes.length = 0;
    // This is what the afterAuth hook in web/index.js calls.
    await expect(hintSync.sync({ id: "new", shop: SHOP_A })).resolves.toBe("ok");
    expect(JSON.parse(shopify.state.writes.at(-1).value).t).toHaveLength(1);
  });

  it("keeps sync from throwing, because a failing hook would fail the request", async () => {
    const shopify = fakeShopify({ failWith: new Error("Shopify is down") });
    const { hintSync } = createTestApp({ shopify });
    await expect(hintSync.sync({ id: "new", shop: SHOP_A })).resolves.toBe("failed");
  });
});

describe("GET /api/shop", () => {
  it("returns the timezone and domain", async () => {
    const { app } = createTestApp();
    const response = await authed(request(app).get("/api/shop"));
    expect(response.body).toEqual({ ianaTimezone: "Asia/Kolkata", domain: "shop-a.myshopify.com" });
  });

  it("returns 500 with no internals when Shopify fails", async () => {
    const { app } = createTestApp({ shopify: fakeShopify({ failWith: new Error("secret internals") }) });
    const response = await authed(request(app).get("/api/shop"));
    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL");
    expect(JSON.stringify(response.body)).not.toContain("secret internals");
  });
});

describe("T-9 rate limit", () => {
  it("returns 429 with Retry-After, per shop", async () => {
    const { app } = createTestApp({ limits: { admin: 2, storefrontRead: 100, storefrontWrite: 100 } });
    const get = (shop) => authed(request(app).get("/api/timers"), shop);
    expect((await get(SHOP_A)).status).toBe(200);
    expect((await get(SHOP_A)).status).toBe(200);
    const blocked = await get(SHOP_A);
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe("RATE_LIMITED");
    expect(blocked.headers["retry-after"]).toBeDefined();
    expect(blocked.headers["cache-control"]).toBe("no-store");
    expect((await get(SHOP_B)).status).toBe(200);
  });
});
