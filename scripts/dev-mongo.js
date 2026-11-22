// scripts/dev-mongo.js — starts a throwaway local MongoDB (no install needed) for development.
//   npm run dev:mongo     → keeps a mongod running on port 27017, data stored in ./data
// Then point MONGODB_URI=mongodb://localhost:27017 in .env and run the app.
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { MongoMemoryServer } from "mongodb-memory-server";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, "..", "data");
fs.mkdirSync(dbPath, { recursive: true });

console.log("[dev-mongo] starting local MongoDB on port 27017 (first run downloads a one-off binary ~70MB)…");
const mongod = await MongoMemoryServer.create({
  instance: { port: 27017, dbPath, storageEngine: "wiredTiger" },
});

console.log("[dev-mongo] ready.");
console.log("[dev-mongo] URI:  " + mongod.getUri());
console.log("[dev-mongo] data: " + dbPath);
console.log("[dev-mongo] press Ctrl+C to stop.");

const shutdown = async () => { await mongod.stop(); process.exit(0); };
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
