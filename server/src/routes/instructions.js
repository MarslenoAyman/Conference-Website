import { Router } from "express";
import { randomUUID } from "crypto";
import { pool } from "../db/pool.js";
import { authenticate, requireRole } from "../auth.js";
import { notify } from "./notifications.js";
import { bilingual } from "../translate.js";

const router = Router();
router.use(authenticate);

// Each instruction / section carries both languages; the client shows whichever
// matches the active theme, falling back to the original text.
const instrOut = (i) => ({ id: i.id, text: i.text, textAr: i.text_ar || i.text, textEn: i.text_en || i.text });
const sectionName = (s) => ({ nameAr: s.name_ar || s.name, nameEn: s.name_en || s.name });

// Sections, each with its own instructions sorted chronologically.
router.get("/", async (req, res, next) => {
  try {
    const { rows: sections } = await pool.query(
      "SELECT id, name, name_ar, name_en FROM instruction_sections ORDER BY created_at"
    );
    const { rows: instr } = await pool.query(
      "SELECT id, text, text_ar, text_en, section_id FROM instructions WHERE section_id IS NOT NULL ORDER BY created_at"
    );
    res.json({
      sections: sections.map((s) => ({
        id: s.id,
        name: s.name,
        ...sectionName(s),
        instructions: instr.filter((i) => i.section_id === s.id).map(instrOut),
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
    const { ar, en } = await bilingual(name);
    const { rows } = await pool.query(
      "INSERT INTO instruction_sections (id, name, name_ar, name_en) VALUES ($1, $2, $3, $4) RETURNING id, name, name_ar, name_en",
      [randomUUID(), name.trim(), ar, en]
    );
    res.status(201).json({ section: { id: rows[0].id, name: rows[0].name, ...sectionName(rows[0]), instructions: [] } });
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
    const { ar, en } = await bilingual(text);
    const { rows } = await pool.query(
      "INSERT INTO instructions (id, text, text_ar, text_en, section_id) VALUES ($1, $2, $3, $4, $5) RETURNING id, text, text_ar, text_en",
      [randomUUID(), text.trim(), ar, en, sectionId]
    );
    await notify(`New instruction (${sectionRows[0].name}): ${text.trim()}`, "info");
    res.status(201).json({ instruction: instrOut(rows[0]), sectionId });
  } catch (err) {
    next(err);
  }
});

router.put("/:id", requireRole("full", "limited"), async (req, res, next) => {
  try {
    const { text } = req.body || {};
    if (!text || !text.trim()) return res.status(400).json({ error: "Instruction text is required." });
    const { ar, en } = await bilingual(text);
    const { rows } = await pool.query(
      "UPDATE instructions SET text = $1, text_ar = $2, text_en = $3 WHERE id = $4 RETURNING id, text, text_ar, text_en",
      [text.trim(), ar, en, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Instruction not found." });
    res.json({ instruction: instrOut(rows[0]) });
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
