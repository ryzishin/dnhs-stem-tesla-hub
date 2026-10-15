// src/config/db.js
// MongoDB connection (Mongoose). Used by all models/services.
import mongoose from "mongoose";
import { config } from "./env.js";

let isConnected = false;

export async function connectDB() {
  if (isConnected) return mongoose.connection;
  if (!config.mongodb.uri) {
    console.error("[db] MONGODB_URI is not set. Copy .env.example to .env and fill it in.");
    process.exit(1);
  }
  mongoose.set("strictQuery", true);
  await mongoose.connect(config.mongodb.uri, {
    dbName: config.mongodb.dbName,
    autoIndex: true,
  });
  isConnected = true;
  console.log(`[db] Connected to MongoDB: ${config.mongodb.dbName}`);
  return mongoose.connection;
}

export default mongoose;
