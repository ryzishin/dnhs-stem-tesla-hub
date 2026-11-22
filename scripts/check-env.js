// scripts/check-env.js — sanity-check configuration without booting the whole app.
//   npm run check
import "dotenv/config";
import mongoose from "mongoose";

const uri = process.env.MONGODB_URI || "";
const dbName = process.env.MONGODB_DB_NAME || "stem_tesla_hub";
const secret = process.env.SESSION_SECRET || "";

console.log("STEM Tesla Hub · environment check\n");
console.log("  MONGODB_DB_NAME : " + dbName);
console.log("  MONGODB_URI     : " + (uri ? uri.replace(/\/\/[^@]*@/, "//***@") : "MISSING"));
console.log("  SESSION_SECRET  : " + (secret ? "set (" + secret.length + " chars)" : "MISSING"));
console.log("  PUBLIC_URL      : " + (process.env.PUBLIC_URL || "(unset, defaults to http://localhost:3000)"));
console.log("  NODE_ENV        : " + (process.env.NODE_ENV || "development"));

if (!uri) { console.log("\n  [x] MONGODB_URI is required. See .env.example."); process.exit(1); }
if (!secret && process.env.NODE_ENV === "production") { console.log("\n  [x] SESSION_SECRET is required in production (openssl rand -hex 32)."); process.exit(1); }

console.log("\n  connecting to MongoDB…");
try {
  await mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 10000 });
  const collections = await mongoose.connection.db.listCollections().toArray();
  const names = collections.map((c) => c.name);
  console.log("  [ok] connected. collections: " + (names.length ? names.join(", ") : "(none yet — run npm run db:seed)"));
  await mongoose.disconnect();
  console.log("\n  All good. You can start the app with: npm start");
} catch (err) {
  console.log("  [x] connection failed: " + err.message);
  console.log("    Atlas checklist: correct username/password, IP 0.0.0.0/0 in Network Access, database user has read/write.");
  process.exit(1);
}
