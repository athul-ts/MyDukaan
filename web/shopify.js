import { ApiVersion } from "@shopify/shopify-api";
import { shopifyApp } from "@shopify/shopify-app-express";
import { MongoDBSessionStorage } from "@shopify/shopify-app-session-storage-mongodb";
import { config } from "./config.js";

export function createShopify({ afterAuth }) {
  return shopifyApp({
    api: { apiVersion: ApiVersion.October26 },
    // These paths are required by the library, but the routes are unused under token exchange.
    auth: { path: "/api/auth", callbackPath: "/api/auth/callback" },
    webhooks: { path: "/api/webhooks" },
    future: { tokenExchange: true },
    sessionStorage: new MongoDBSessionStorage(config.mongo.url, config.mongo.database),
    hooks: { afterAuth },
  });
}
