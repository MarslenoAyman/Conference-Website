import { Router } from "express";
import { randomUUID } from "crypto";
import { pool } from "../db/pool.js";
import { authenticate, requireRole } from "../auth.js";

const router = Router();
router.use(authenticate);

router.get("/", async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT id, title, speaker, description FROM topics ORDER BY created_at");
    res.json({ topics: rows });
  } catch (err) {
    next(err);
  }
});

router.post("/", requireRole("full"), async (req, res, next) => {
  try {
    const { title, speaker, description } = req.body || {};
    if (!title || !title.trim()) return res.status(400).json({ error: "Topic title is required." });
    const { rows } = await pool.query(
      "INSERT INTO topics (id, title, speaker, description) VALUES ($1, $2, $3, $4) RETURNING id, title, speaker, description",
      [randomUUID(), title.trim(), (speaker || "لم يتحدد").trim() || "لم يتحدد", (description || "").trim()]
    );
    res.status(201).json({ topic: rows[0] });
  } catch (err) {
    next(err);
  }
});

router.put("/:id", requireRole("full"), async (req, res, next) => {
  try {
    const { title, speaker, description } = req.body || {};
    const { rows: existingRows } = await pool.query("SELECT * FROM topics WHERE id = $1", [req.params.id]);
    if (!existingRows[0]) return res.status(404).json({ error: "Topic not found." });
    const existing = existingRows[0];
    const nextTitle = title !== undefined ? title.trim() : existing.title;
    const nextSpeaker = speaker !== undefined ? speaker.trim() || "لم يتحدد" : existing.speaker;
    const nextDescription = description !== undefined ? description.trim() : existing.description;
    const { rows } = await pool.query(
      "UPDATE topics SET title = $1, speaker = $2, description = $3 WHERE id = $4 RETURNING id, title, speaker, description",
      [nextTitle, nextSpeaker, nextDescription, req.params.id]
    );
    res.json({ topic: rows[0] });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireRole("full"), async (req, res, next) => {
  try {
    const { rowCount } = await pool.query("DELETE FROM topics WHERE id = $1", [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: "Topic not found." });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
