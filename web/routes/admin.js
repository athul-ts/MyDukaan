import express from "express";
import { z } from "zod";
import { findOverlaps } from "../../shared/overlaps.js";
import {
  endMustBeInFuture,
  MAX_TIMERS_PER_SHOP,
  timerInputSchema,
  toIssueDetails,
} from "../../shared/validation.js";
import { sendError } from "../errors.js";
import { toDocument } from "../repositories/timers.js";
import { toAdminTimer } from "../serializers.js";

const listQuerySchema = z.object({
  status: z.enum(["active", "scheduled", "expired"]).optional(),
  q: z.string().max(80).optional(),
  sort: z.enum(["createdAt_desc", "endAt_asc", "name_asc"]).default("createdAt_desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

const SHOP_QUERY = `{ shop { ianaTimezone myshopifyDomain } }`;

export function createAdminRouter({ timers, stats, shopState, hintSync, admin }) {
  const router = express.Router();
  const sessionOf = (res) => res.locals.shopify.session;

  const parseInput = (req, res) => {
    const result = timerInputSchema.safeParse(req.body);
    if (result.success) return result.data;
    sendError(res, 422, "VALIDATION_FAILED", "Timer is invalid", toIssueDetails(result.error));
    return null;
  };

  const rejectPastEnd = (res) =>
    sendError(res, 422, "VALIDATION_FAILED", "Timer is invalid", [
      { path: "endAt", message: "Must be in the future" },
    ]);

  router.get("/timers", async (req, res) => {
    const query = listQuerySchema.safeParse(req.query);
    if (!query.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid query", toIssueDetails(query.error));
    }
    const { shop } = sessionOf(res);
    const now = Date.now();
    const [{ timers: page, total }, all, hintState] = await Promise.all([
      timers.list(shop, query.data, now),
      timers.listAll(shop),
      shopState.hintSyncState(shop),
    ]);
    const counts = await stats.countsFor(shop, page.map((timer) => timer._id));
    const overlaps = findOverlaps(all, now);
    return res.json({
      timers: page.map((timer) => {
        const id = String(timer._id);
        return toAdminTimer(timer, {
          now,
          impressions: counts.get(id) ?? 0,
          overlapsWith: overlaps.get(id) ?? [],
        });
      }),
      page: query.data.page,
      pageSize: query.data.pageSize,
      total,
      hintSync: hintState,
    });
  });

  router.post("/timers", async (req, res) => {
    const input = parseInput(req, res);
    if (!input) return undefined;
    const session = sessionOf(res);
    if ((await timers.count(session.shop)) >= MAX_TIMERS_PER_SHOP) {
      return sendError(res, 422, "VALIDATION_FAILED", "Timer limit reached", [
        { path: "", message: `A shop can have up to ${MAX_TIMERS_PER_SHOP} timers` },
      ]);
    }
    if (endMustBeInFuture(input, null) && new Date(input.endAt).getTime() <= Date.now()) {
      return rejectPastEnd(res);
    }
    const created = await timers.create(session.shop, toDocument(input));
    const synced = await hintSync.sync(session);
    return res.status(201).json({ timer: toAdminTimer(created), hintSync: synced });
  });

  router.get("/timers/:id", async (req, res) => {
    const { shop } = sessionOf(res);
    const timer = await timers.findById(shop, req.params.id);
    if (!timer) return sendError(res, 404, "NOT_FOUND", "Timer not found");
    const counts = await stats.countsFor(shop, [timer._id]);
    return res.json({
      timer: toAdminTimer(timer, { impressions: counts.get(String(timer._id)) ?? 0 }),
    });
  });

  router.put("/timers/:id", async (req, res) => {
    const session = sessionOf(res);
    const existing = await timers.findById(session.shop, req.params.id);
    if (!existing) return sendError(res, 404, "NOT_FOUND", "Timer not found");
    const input = parseInput(req, res);
    if (!input) return undefined;
    if (endMustBeInFuture(input, existing) && new Date(input.endAt).getTime() <= Date.now()) {
      return rejectPastEnd(res);
    }
    const updated = await timers.replace(session.shop, req.params.id, toDocument(input));
    if (!updated) return sendError(res, 404, "NOT_FOUND", "Timer not found");
    const counts = await stats.countsFor(session.shop, [updated._id]);
    const synced = await hintSync.sync(session);
    return res.json({
      timer: toAdminTimer(updated, { impressions: counts.get(String(updated._id)) ?? 0 }),
      hintSync: synced,
    });
  });

  router.delete("/timers/:id", async (req, res) => {
    const session = sessionOf(res);
    const removed = await timers.remove(session.shop, req.params.id);
    if (!removed) return sendError(res, 404, "NOT_FOUND", "Timer not found");
    await stats.removeFor(session.shop, removed._id);
    const synced = await hintSync.sync(session);
    return res.json({ deleted: true, hintSync: synced });
  });

  router.get("/shop", async (_req, res) => {
    const data = await admin.request(sessionOf(res), SHOP_QUERY);
    return res.json({
      ianaTimezone: data.shop.ianaTimezone,
      domain: data.shop.myshopifyDomain,
    });
  });

  router.post("/hint/sync", async (_req, res) => {
    const synced = await hintSync.sync(sessionOf(res), { rethrowAuth: true });
    return res.json({ hintSync: synced });
  });

  return router;
}
