import mongoose from "mongoose";
import { config } from "./config.js";

// A second layer behind schema validation. Operators in filters the server builds
// itself must be wrapped in mongoose.trusted(). See specs/03-data-model.md.
mongoose.set("sanitizeFilter", true);

export function connectDb() {
  return mongoose.connect(config.mongo.url, { dbName: config.mongo.database });
}
