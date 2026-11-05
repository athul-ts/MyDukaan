import mongoose from "mongoose";

const timerSchema = new mongoose.Schema(
  {
    shop: { type: String, required: true },
    name: { type: String, required: true },
    type: { type: String, enum: ["fixed", "evergreen"], required: true },
    startAt: { type: Date, default: null },
    endAt: { type: Date, default: null },
    durationMinutes: { type: Number, default: null },
    headline: { type: String, default: "" },
    description: { type: String, default: "" },
    style: {
      backgroundColor: { type: String, required: true },
      textColor: { type: String, required: true },
      size: { type: String, enum: ["small", "medium", "large"], required: true },
      position: { type: String, enum: ["inline", "top_bar", "bottom_bar"], required: true },
    },
    urgency: {
      mode: { type: String, enum: ["none", "color_pulse"], required: true },
      thresholdMinutes: { type: Number, required: true },
    },
    targeting: {
      scope: { type: String, enum: ["all", "products", "collections"], required: true },
      productIds: { type: [String], default: [] },
      collectionIds: { type: [String], default: [] },
      labels: {
        type: [
          new mongoose.Schema(
            { id: { type: String, required: true }, title: { type: String, default: "" } },
            { _id: false, id: false },
          ),
        ],
        default: [],
      },
    },
  },
  { timestamps: true, collection: "timers" },
);

timerSchema.index({ shop: 1, endAt: 1 });
timerSchema.index({ shop: 1, createdAt: -1 });

export const Timer = mongoose.model("Timer", timerSchema);
