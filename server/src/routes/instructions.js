import { Router } from "express";
import { randomUUID } from "crypto";
import { pool } from "../db/pool.js";
import { authenticate, requireRole } from "../auth.js";

const router = Router();
router.use(authenticate);

router.get("/", async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT id, text FROM instructions ORDER BY created_at");
    res.json({ instructions: rows });
  } catch (err) {
    next(err);
  }
});

router.post("/", requireRole("full", "limited"), async (req, res, next) => {
  try {
    const { text } = req.body || {};
    if (!text || !text.trim()) return res.status(400).json({ error: "Instruction text is required." });
    const { rows } = await pool.query("INSERT INTO instructions (id, text) VALUES ($1, $2) RETURNING id, text", [
      randomUUID(),
      text.trim(),
    ]);
    res.status(201).json({ instruction: rows[0] });
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
