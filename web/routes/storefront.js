import express from "express";
import { z } from "zod";
import { pickCandidates, rankCandidates } from "../../shared/selection.js";
import { sendError } from "../errors.js";
import { toPublicTimer } from "../serializers.js";

const MAX_COLLECTION_IDS = 50;
const CACHE_CONTROL = "public, max-age=30, stale-while-revalidate=120";

const timersQuerySchema = z.object({
  productId: z.string().regex(/^\d+$/),
  collectionIds: z
    .string()
    .regex(/^(\d+(,\d+)*)?$/)
    .optional(),
});

export function createStorefrontRouter({ timers, stats }) {
  const router = express.Router();

  router.get("/timers", async (req, res) => {
    const query = timersQuerySchema.safeParse({
      productId: req.query.productId,
      collectionIds: req.query.collectionIds,
    });
    const collectionIds = query.data?.collectionIds?.split(",").filter(Boolean) ?? [];
    if (!query.success || collectionIds.length > MAX_COLLECTION_IDS) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid product or collection IDs");
    }
    const now = Date.now();
    const matching = await timers.findStorefrontCandidates(
      res.locals.shop,
      { productId: query.data.productId, collectionIds },
      now,
    );
    res.set("Cache-Control", CACHE_CONTROL);
    return res.json({ timers: pickCandidates(rankCandidates(matching), now).map(toPublicTimer) });
  });

  // sendBeacon may send text/plain, so the body is read as text whatever its content type.
  router.post("/impressions", express.text({ type: () => true, limit: "10kb" }), async (req, res) => {
    let body;
    try {
      body = JSON.parse(req.body);
    } catch {
      return sendError(res, 400, "BAD_REQUEST", "The request body couldn't be read");
    }
    const timerId = body?.timerId;
    const timer = typeof timerId === "string" ? await timers.findById(res.locals.shop, timerId) : null;
    if (!timer) return sendError(res, 404, "NOT_FOUND", "Timer not found");
    await stats.increment(res.locals.shop, timer._id);
    return res.status(202).end();
  });

  return router;
}
