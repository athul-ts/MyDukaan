import crypto from "node:crypto";
import { sendError } from "../errors.js";

const SHOP_PATTERN = /^[a-z0-9-]+\.myshopify\.com$/;

/** Shopify's documented app proxy method: decoded, grouped, sorted, then joined with nothing. */
export function computeProxySignature(rawQuery, secret) {
  const grouped = {};
  for (const [key, value] of new URLSearchParams(rawQuery)) {
    (grouped[key] ??= []).push(value);
  }
  delete grouped.signature;
  const message = Object.keys(grouped)
    .map((key) => `${key}=${grouped[key].join(",")}`)
    .sort()
    .join("");
  return crypto.createHmac("sha256", secret).update(message).digest("hex");
}

export function verifyProxy(secret) {
  return (req, res, next) => {
    const rawQuery = req.originalUrl.split("?")[1] ?? "";
    const params = new URLSearchParams(rawQuery);
    const signature = params.get("signature");
    const shop = params.get("shop");

    const expected = Buffer.from(computeProxySignature(rawQuery, secret));
    const received = Buffer.from(signature ?? "");
    const valid =
      signature &&
      expected.length === received.length &&
      crypto.timingSafeEqual(expected, received);

    if (!valid || !shop || !SHOP_PATTERN.test(shop)) {
      return sendError(res, 401, "UNAUTHORIZED", "Invalid signature");
    }
    // The only place a storefront request's shop comes from.
    res.locals.shop = shop;
    return next();
  };
}
