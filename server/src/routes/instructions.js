import { Router } from "express";
import { randomUUID } from "crypto";
import { pool } from "../db/pool.js";
import { authenticate, requireRole } from "../auth.js";
import { notify } from "./notifications.js";

const router = Router();
router.use(authenticate);

// Sections, each with its own instructions sorted chronologically.
router.get("/", async (req, res, next) => {
  try {
    const { rows: sections } = await pool.query(
      "SELECT id, name FROM instruction_sections ORDER BY created_at"
    );
    const { rows: instr } = await pool.query(
      "SELECT id, text, section_id FROM instructions WHERE section_id IS NOT NULL ORDER BY created_at"
    );
    res.json({
      sections: sections.map((s) => ({
        id: s.id,
        name: s.name,
        instructions: instr.filter((i) => i.section_id === s.id).map((i) => ({ id: i.id, text: i.text })),
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.post("/sections", requireRole("full", "limited"), async (req, res, next) => {
  try {
    const { name } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: "A section name is required." });
    const { rows } = await pool.query(
      "INSERT INTO instruction_sections (id, name) VALUES ($1, $2) RETURNING id, name",
      [randomUUID(), name.trim()]
    );
    res.status(201).json({ section: { id: rows[0].id, name: rows[0].name, instructions: [] } });
  } catch (err) {
    next(err);
  }
});

router.delete("/sections/:id", requireRole("full", "limited"), async (req, res, next) => {
  try {
    const { rowCount } = await pool.query("DELETE FROM instruction_sections WHERE id = $1", [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: "Section not found." });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Add an instruction to a section — notifies everyone once.
router.post("/", requireRole("full", "limited"), async (req, res, next) => {
  try {
    const { text, sectionId } = req.body || {};
    if (!text || !text.trim()) return res.status(400).json({ error: "Instruction text is required." });
    if (!sectionId) return res.status(400).json({ error: "A section is required." });
    const { rows: sectionRows } = await pool.query("SELECT name FROM instruction_sections WHERE id = $1", [sectionId]);
    if (!sectionRows[0]) return res.status(404).json({ error: "Section not found." });
    const { rows } = await pool.query(
      "INSERT INTO instructions (id, text, section_id) VALUES ($1, $2, $3) RETURNING id, text",
      [randomUUID(), text.trim(), sectionId]
    );
    await notify(`New instruction (${sectionRows[0].name}): ${text.trim()}`, "info");
    res.status(201).json({ instruction: rows[0], sectionId });
  } catch (err) {
    next(err);
  }
});

router.put("/:id", requireRole("full", "limited"), async (req, res, next) => {
  try {
    const { text } = req.body || {};
    if (!text || !text.trim()) return res.status(400).json({ error: "Instruction text is required." });
    const { rows } = await pool.query("UPDATE instructions SET text = $1 WHERE id = $2 RETURNING id, text", [
      text.trim(),
      req.params.id,
    ]);
    if (!rows[0]) return res.status(404).json({ error: "Instruction not found." });
    res.json({ instruction: rows[0] });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireRole("full", "limited"), async (req, res, next) => {
  try {
    const { rowCount } = await pool.query("DELETE FROM instructions WHERE id = $1", [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: "Instruction not found." });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
