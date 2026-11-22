// src/services/ids.js — short readable ids for embedded blocks, cards, options, items.
import { randomBytes } from "node:crypto";

export function noteId(prefix = "b") {
  return `${prefix}${randomBytes(5).toString("hex")}`;
}
