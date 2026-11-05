import { ShopState } from "../models/ShopState.js";

function requireShop(shop) {
  if (!shop) throw new Error("A shop is required for all shop state access");
}

export const shopStateRepository = {
  async recordHintSync(shop, succeeded) {
    requireShop(shop);
    await ShopState.updateOne(
      { shop },
      { $set: { hintSyncFailedAt: succeeded ? null : new Date() } },
      { upsert: true },
    );
  },

  async hintSyncState(shop) {
    requireShop(shop);
    const state = await ShopState.findOne({ shop }).lean();
    return state?.hintSyncFailedAt ? "failed" : "ok";
  },
};
