import { fileURLToPath } from "node:url";

// `shopify app dev` supplies the Shopify variables. This only adds local overrides,
// and never replaces a variable that's already set.
try {
  process.loadEnvFile(fileURLToPath(new URL("../.env", import.meta.url)));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

const mongoUrl = new URL(
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/countdown_timer",
);
const database = mongoUrl.pathname.slice(1) || "countdown_timer";
mongoUrl.pathname = "/";

export const config = {
  port: parseInt(process.env.BACKEND_PORT || process.env.PORT || "3000", 10),
  isProduction: process.env.NODE_ENV === "production",
  apiKey: process.env.SHOPIFY_API_KEY || "",
  mongo: { url: mongoUrl.toString(), database },
};
