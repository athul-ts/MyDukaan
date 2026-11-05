import mongoose from "mongoose";
import { TimerStats } from "../models/TimerStats.js";

const { trusted } = mongoose;

function requireShop(shop) {
  if (!shop) throw new Error("A shop is required for all stats access");
}

const DUPLICATE_KEY = 11000;

export const statsRepository = {
  async increment(shop, timerId) {
    requireShop(shop);
    const update = () =>
      TimerStats.updateOne(
        { shop, timerId },
        { $inc: { impressions: 1 }, $set: { lastImpressionAt: new Date() } },
        { upsert: true },
      );
    try {
      await update();
    } catch (error) {
      // Two first impressions can race on the upsert, and then the document exists for the retry.
      if (error.code !== DUPLICATE_KEY) throw error;
      await update();
    }
  },

  /** Returns a map of timer ID to impression count. */
  async countsFor(shop, timerIds) {
    requireShop(shop);
    const rows = await TimerStats.find({ shop, timerId: trusted({ $in: timerIds }) }).lean();
    return new Map(rows.map((row) => [String(row.timerId), row.impressions]));
  },

  async removeFor(shop, timerId) {
    requireShop(shop);
    await TimerStats.deleteOne({ shop, timerId });
  },
};
