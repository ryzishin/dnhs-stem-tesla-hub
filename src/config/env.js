// src/config/env.js
import dotenv from "dotenv";
dotenv.config();

// v2-P0-1: Fail-closed config validation.
// The previous version had `sessionSecret: required("SESSION_SECRET", "dev-session-secret-change-me")`
// — the fallback meant the app would silently boot with a publicly-visible secret,
// letting anyone forge session cookies. Now: a missing required var with no fallback
// exits the process with a clear error. A missing required var WITH a fallback uses
// the fallback (only safe for non-secret values like empty-string defaults).
function required(name, fallback) {
  const v = process.env[name];
  if (v === undefined || v === "") {
    if (fallback !== undefined) return fallback;
    console.error(`[config] Missing required env var: ${name}`);
    console.error(`[config] Copy .env.example to .env and fill in the values.`);
    process.exit(1);
  }
  return v;
}

export const config = {
  env: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 3000,
  sessionSecret: required("SESSION_SECRET"), // v2-P0-1: NO FALLBACK — fail-closed.
  mongodb: {
    uri: required("MONGODB_URI", ""),
    dbName: process.env.MONGODB_DB_NAME || "stem_tesla_biohub",
  },
  publicUrl: process.env.PUBLIC_URL || "http://localhost:3000",
};

export default config;
