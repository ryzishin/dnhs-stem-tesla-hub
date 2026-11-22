// src/config/db.js — one Mongoose connection for the whole app.
import mongoose from "mongoose";
import { config } from "./env.js";

export async function connectDB() {
  mongoose.set("strictQuery", true);
  const uri = config.mongodb.uri;
  const host = uri.replace(/\/\/[^@]*@/, "//***@"); // never log credentials
  try {
    mongoose.connection.on("connected", () => console.log(`[db] connected (${host} / ${config.mongodb.dbName})`));
    mongoose.connection.on("error", (err) => console.error("[db] error:", err.message));
    mongoose.connection.on("disconnected", () => console.warn("[db] disconnected"));
    await mongoose.connect(uri, { dbName: config.mongodb.dbName, serverSelectionTimeoutMS: 10000 });
  } catch (err) {
    console.error("[db] connection failed:", err.message);
    console.error("      Check MONGODB_URI (and Atlas Network Access: allow 0.0.0.0/0 for Render).");
    process.exit(1);
  }
}
