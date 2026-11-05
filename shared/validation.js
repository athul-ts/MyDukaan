import { z } from "zod";
import { toMs } from "./time.js";

export const MAX_TIMERS_PER_SHOP = 200;
export const DEFAULT_HEADLINE = "Offer ends in";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** Strips tags, including unclosed and nested ones, and control characters. */
export function sanitizeText(value) {
  let text = value;
  let previous;
  do {
    previous = text;
    text = text.replace(/<[a-zA-Z/!?][^>]*(>|$)/g, "");
  } while (text !== previous);
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\u0000-\u001F\u007F]/g, "").trim();
}

const cleanText = (schema) => z.string().transform(sanitizeText).pipe(schema);

const resource = (type) =>
  z.strictObject({
    id: z.string().regex(new RegExp(`^gid://shopify/${type}/\\d+$`), `Must be a ${type} ID`),
    title: cleanText(z.string().max(255)),
  });

const issue = (ctx, path, message) => ctx.addIssue({ code: "custom", path, message });

export const timerInputSchema = z
  .strictObject({
    name: cleanText(z.string().min(1, "Name is required").max(80)),
    type: z.enum(["fixed", "evergreen"]),
    startAt: z.iso.datetime().optional(),
    endAt: z.iso.datetime().optional(),
    durationMinutes: z.number().int().min(1).max(43200).optional(),
    headline: cleanText(z.string().max(60)).optional(),
    description: cleanText(z.string().max(200)).optional(),
    style: z.strictObject({
      backgroundColor: z.string().regex(HEX_COLOR, "Must be a hex colour like #112233"),
      textColor: z.string().regex(HEX_COLOR, "Must be a hex colour like #112233"),
      size: z.enum(["small", "medium", "large"]),
      position: z.enum(["inline", "top_bar", "bottom_bar"]),
    }),
    urgency: z.strictObject({
      mode: z.enum(["none", "color_pulse"]),
      thresholdMinutes: z.number().int().min(1).default(5),
    }),
    targeting: z.strictObject({
      scope: z.enum(["all", "products", "collections"]),
      products: z.array(resource("Product")).max(250),
      collections: z.array(resource("Collection")).max(250),
    }),
  })
  .superRefine((input, ctx) => {
    if (input.type === "fixed") {
      if (input.durationMinutes !== undefined) {
        issue(ctx, ["durationMinutes"], "Only evergreen timers have a duration");
      }
      if (!input.startAt) issue(ctx, ["startAt"], "Start is required");
      if (!input.endAt) issue(ctx, ["endAt"], "End is required");
      if (input.startAt && input.endAt && toMs(input.startAt) >= toMs(input.endAt)) {
        issue(ctx, ["endAt"], "Must be after start");
      }
    } else {
      if (input.startAt !== undefined) issue(ctx, ["startAt"], "Only fixed timers have a start");
      if (input.endAt !== undefined) issue(ctx, ["endAt"], "Only fixed timers have an end");
      if (input.durationMinutes === undefined) {
        issue(ctx, ["durationMinutes"], "Duration is required");
      } else if (input.urgency.thresholdMinutes > input.durationMinutes) {
        issue(ctx, ["urgency", "thresholdMinutes"], "Can't be longer than the duration");
      }
    }

    const { scope, products, collections } = input.targeting;
    if (scope === "products" && products.length === 0) {
      issue(ctx, ["targeting", "products"], "Choose at least one product");
    }
    if (scope === "collections" && collections.length === 0) {
      issue(ctx, ["targeting", "collections"], "Choose at least one collection");
    }
    if (scope !== "products" && products.length > 0) {
      issue(ctx, ["targeting", "products"], "Only allowed when targeting products");
    }
    if (scope !== "collections" && collections.length > 0) {
      issue(ctx, ["targeting", "collections"], "Only allowed when targeting collections");
    }
  })
  .transform((input) => ({
    ...input,
    headline: input.headline || DEFAULT_HEADLINE,
    description: input.description ?? "",
  }));

/**
 * Needs the stored timer, so it runs on the server only. An expired timer can still be edited
 * as long as its dates don't change.
 */
export function endMustBeInFuture(input, existing) {
  if (input.type !== "fixed") return false;
  if (!existing || existing.type !== "fixed") return true;
  return (
    toMs(input.startAt) !== toMs(existing.startAt) || toMs(input.endAt) !== toMs(existing.endAt)
  );
}

export function toIssueDetails(error) {
  return error.issues.map((item) => ({
    path: item.path.join("."),
    message: item.message,
  }));
}
