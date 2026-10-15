// src/controllers/notesController.js
import {
  listUnits, getUnit, createUnit, updateUnit, deleteUnit, createPart, updatePart, deletePart, saveBlocks,
} from "../services/notes.js";

export async function listNotes(req, res) {
  try {
    const units = await listUnits();
    res.render("notes/index", { title: "Notes", units });
  } catch (err) {
    console.error("[listNotes]", err);
    res.status(500).render("error/500", { message: err.message });
  }
}

export async function showUnit(req, res) {
  try {
    const unit = await getUnit(req.params.slug);
    if (!unit) return res.status(404).render("error/404");
    res.render("notes/unit", { title: unit.title, unit });
  } catch (err) {
    console.error("[showUnit]", err);
    res.status(500).render("error/500", { message: err.message });
  }
}

export async function editor(req, res) {
  try {
    const units = await listUnits();
    res.render("notes/editor", { title: "Edit Notes", units });
  } catch (err) {
    console.error("[notes editor]", err);
    res.status(500).render("error/500", { message: err.message });
  }
}

export async function createUnitPost(req, res) {
  try {
    const u = await createUnit(req.body);
    await createPart(u._id, { title: "Introduction" });
    res.json({ ok: true, unit: u });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

export async function updateUnitPost(req, res) {
  try {
    const u = await updateUnit(req.params.id, req.body);
    res.json({ ok: true, unit: u });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

export async function deleteUnitPost(req, res) {
  try {
    await deleteUnit(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

export async function createPartPost(req, res) {
  try {
    const p = await createPart(req.params.unitId, req.body);
    res.json({ ok: true, part: p });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

export async function updatePartPost(req, res) {
  try {
    const p = await updatePart(req.params.id, req.body);
    res.json({ ok: true, part: p });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

export async function deletePartPost(req, res) {
  try {
    await deletePart(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

export async function saveBlocksPost(req, res) {
  try {
    await saveBlocks(req.params.partId, req.body.blocks || []);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
