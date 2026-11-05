import mongoose from "mongoose";

const shopStateSchema = new mongoose.Schema(
  {
    shop: { type: String, required: true, unique: true },
    hintSyncFailedAt: { type: Date, default: null },
  },
  { collection: "shop_state" },
);

export const ShopState = mongoose.model("ShopState", shopStateSchema);
