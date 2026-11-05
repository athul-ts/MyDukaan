import mongoose from "mongoose";
import { LEAD_IN_MS } from "../../shared/selection.js";
import { Timer } from "../models/Timer.js";

const { trusted } = mongoose;

// The app sets sanitizeFilter, so operators in filters built here must be wrapped in trusted().
// Never wrap a value from a request. See specs/03-data-model.md.

function requireShop(shop) {
  if (!shop) throw new Error("A shop is required for all timer access");
}

const numericId = (gid) => gid.slice(gid.lastIndexOf("/") + 1);

/** Turns validated API input into a stored document. */
export function toDocument(input) {
  const { targeting } = input;
  const isFixed = input.type === "fixed";
  const isProducts = targeting.scope === "products";
  const isCollections = targeting.scope === "collections";
  return {
    name: input.name,
    type: input.type,
    startAt: isFixed ? new Date(input.startAt) : null,
    endAt: isFixed ? new Date(input.endAt) : null,
    durationMinutes: isFixed ? null : input.durationMinutes,
    headline: input.headline,
    description: input.description,
    style: input.style,
    urgency: input.urgency,
    targeting: {
      scope: targeting.scope,
      productIds: isProducts ? targeting.products.map((item) => numericId(item.id)) : [],
      collectionIds: isCollections ? targeting.collections.map((item) => numericId(item.id)) : [],
      labels: isProducts ? targeting.products : isCollections ? targeting.collections : [],
    },
  };
}

const STATUS_FILTERS = {
  active: (now) => ({
    $or: [{ type: "evergreen" }, { startAt: trusted({ $lte: now }), endAt: trusted({ $gt: now }) }],
  }),
  scheduled: (now) => ({ type: "fixed", startAt: trusted({ $gt: now }) }),
  expired: (now) => ({ type: "fixed", endAt: trusted({ $lte: now }) }),
};

const SORTS = {
  createdAt_desc: { createdAt: -1, _id: -1 },
  // "fixed" sorts before "evergreen" when descending, which puts evergreen timers last.
  endAt_asc: { type: -1, endAt: 1, _id: 1 },
  name_asc: { name: 1, _id: 1 },
};

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const timersRepository = {
  async create(shop, document) {
    requireShop(shop);
    const created = await Timer.create({ ...document, shop });
    return created.toObject();
  },

  async findById(shop, id) {
    requireShop(shop);
    if (!mongoose.isValidObjectId(id)) return null;
    return Timer.findOne({ _id: String(id), shop }).lean();
  },

  async replace(shop, id, document) {
    requireShop(shop);
    if (!mongoose.isValidObjectId(id)) return null;
    return Timer.findOneAndUpdate(
      { _id: String(id), shop },
      { $set: document },
      { returnDocument: "after", runValidators: true },
    ).lean();
  },

  async remove(shop, id) {
    requireShop(shop);
    if (!mongoose.isValidObjectId(id)) return null;
    return Timer.findOneAndDelete({ _id: String(id), shop }).lean();
  },

  async count(shop) {
    requireShop(shop);
    return Timer.countDocuments({ shop });
  },

  async listAll(shop) {
    requireShop(shop);
    return Timer.find({ shop }).lean();
  },

  async list(shop, { status, q, sort, page, pageSize }, now) {
    requireShop(shop);
    const filter = { shop, ...(status ? STATUS_FILTERS[status](new Date(now)) : {}) };
    if (q) filter.name = trusted({ $regex: escapeRegex(q), $options: "i" });
    const [timers, total] = await Promise.all([
      Timer.find(filter)
        .collation({ locale: "en", strength: 2 })
        .sort(SORTS[sort])
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      Timer.countDocuments(filter),
    ]);
    return { timers, total };
  },

  /** Matching timers that are evergreen, live, or starting within the lead-in window. */
  async findStorefrontCandidates(shop, { productId, collectionIds }, now) {
    requireShop(shop);
    return Timer.find({
      shop,
      $and: [
        {
          $or: [
            { type: "evergreen" },
            {
              endAt: trusted({ $gt: new Date(now) }),
              startAt: trusted({ $lte: new Date(now + LEAD_IN_MS) }),
            },
          ],
        },
        {
          $or: [
            { "targeting.scope": "all" },
            { "targeting.productIds": productId },
            { "targeting.collectionIds": trusted({ $in: collectionIds }) },
          ],
        },
      ],
    }).lean();
  },
};
