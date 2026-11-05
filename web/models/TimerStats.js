import mongoose from "mongoose";

// Kept apart from timers, as counters change on every page view and config rarely does.
const timerStatsSchema = new mongoose.Schema(
  {
    shop: { type: String, required: true },
    timerId: { type: mongoose.Schema.Types.ObjectId, required: true },
    impressions: { type: Number, default: 0 },
    lastImpressionAt: { type: Date, default: null },
  },
  { collection: "timer_stats" },
);

timerStatsSchema.index({ shop: 1, timerId: 1 }, { unique: true });

export const TimerStats = mongoose.model("TimerStats", timerStatsSchema);
