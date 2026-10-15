// src/services/notes.js
// Notes templating engine — units → parts → content_blocks.
import mongoose from "mongoose";
import { Unit, Part, ContentBlock } from "../models/index.js";

export async function listUnits() {
  const units = await Unit.find({}).sort({ sortOrder: 1 }).lean();
  const out = [];
  for (const u of units) {
    const parts = await Part.find({ unitId: u._id }).sort({ sortOrder: 1 }).lean();
    for (const p of parts) {
      p.blocks = await listBlocksForPart(p._id);
    }
    out.push({ ...u, id: u._id.toString(), parts: parts.map((p) => ({ ...p, id: p._id.toString(), unitId: p.unitId.toString() })) });
  }
  return out;
}

export async function getUnit(slug) {
  const u = await Unit.findOne({ slug }).lean();
  if (!u) return null;
  const parts = await Part.find({ unitId: u._id }).sort({ sortOrder: 1 }).lean();
  for (const p of parts) {
    p.blocks = await listBlocksForPart(p._id);
  }
  return {
    ...u,
    id: u._id.toString(),
    parts: parts.map((p) => ({ ...p, id: p._id.toString(), unitId: p.unitId.toString() })),
  };
}

export async function listBlocksForPart(partId) {
  const blocks = await ContentBlock.find({ partId }).sort({ sortOrder: 1 }).lean();
  return blocks.map((b) => ({ ...b, id: b._id.toString(), partId: b.partId.toString() }));
}

export async function createUnit({ number, title, description, slug }) {
  const count = await Unit.countDocuments();
  const unit = await Unit.create({
    number: number || String(count + 1).padStart(2, "0"),
    title,
    description: description || "",
    slug: slug || title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
    sortOrder: count,
    updatedAt: new Date().toISOString().slice(0, 10),
  });
  return unit;
}

export async function updateUnit(id, patch) {
  const updated = await Unit.findByIdAndUpdate(
    id,
    { ...patch, updatedAt: new Date().toISOString().slice(0, 10) },
    { new: true }
  ).lean();
  return updated;
}

export async function deleteUnit(id) {
  const parts = await Part.find({ unitId: id }).select("_id");
  const partIds = parts.map((p) => p._id);
  await ContentBlock.deleteMany({ partId: { $in: partIds } });
  await Part.deleteMany({ unitId: id });
  await Unit.findByIdAndDelete(id);
}

export async function createPart(unitId, { title }) {
  const count = await Part.countDocuments({ unitId });
  const part = await Part.create({
    unitId,
    title: title || "New Part",
    sortOrder: count,
  });
  return part;
}

export async function updatePart(id, patch) {
  return Part.findByIdAndUpdate(id, patch, { new: true }).lean();
}

export async function deletePart(id) {
  await ContentBlock.deleteMany({ partId: id });
  await Part.findByIdAndDelete(id);
}

// Save the entire set of blocks for a part (delete + re-insert)
export async function saveBlocks(partId, blocks) {
  await ContentBlock.deleteMany({ partId });
  if (!blocks || blocks.length === 0) return;
  const rows = blocks.map((b, i) => ({
    partId,
    kind: b.kind,
    sortOrder: i,
    text: b.text || "",
    level: b.level || null,
    items: b.items || [],
    url: b.url || "",
    caption: b.caption || "",
    variant: b.variant || null,
  }));
  await ContentBlock.insertMany(rows);
}
