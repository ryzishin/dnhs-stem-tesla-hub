// src/config/env.js — central configuration. Reads .env once, validates the essentials.
import "dotenv/config";

function required(name, fallback = "") {
  const v = process.env[name] ?? fallback;
  return v;
}

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  isProd: (process.env.NODE_ENV || "development") === "production",
  port: Number(process.env.PORT || 3000),
  publicUrl: process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`,
  sessionSecret: process.env.SESSION_SECRET || "",
  mongodb: {
    uri: process.env.MONGODB_URI || "",
    dbName: process.env.MONGODB_DB_NAME || "stem_tesla_hub",
  },
};

// In production a real session secret is mandatory; in dev we fall back so the
// app still boots on a school laptop.
if (!env.sessionSecret) {
  if (env.isProd) {
    console.error("[config] SESSION_SECRET is required in production. Generate one with: openssl rand -hex 32");
    process.exit(1);
  }
  env.sessionSecret = "dev-only-secret-change-me";
}

if (!env.mongodb.uri) {
  console.error("[config] MONGODB_URI is missing. See .env.example for the format.");
  process.exit(1);
}

export default env;
export const config = env;
