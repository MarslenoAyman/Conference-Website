import { Router } from "express";
import { randomUUID } from "crypto";
import { pool } from "../db/pool.js";
import { authenticate, requireRole } from "../auth.js";

const router = Router();
router.use(authenticate);

function toGame(row) {
  return { id: row.id, name: row.name, when: row.when_text, description: row.description };
}

router.get("/", async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM games ORDER BY created_at");
    res.json({ games: rows.map(toGame) });
  } catch (err) {
    next(err);
  }
});

router.post("/", requireRole("full"), async (req, res, next) => {
  try {
    const { name, when, description } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: "Game name is required." });
    const { rows } = await pool.query(
      "INSERT INTO games (id, name, when_text, description) VALUES ($1, $2, $3, $4) RETURNING *",
      [randomUUID(), name.trim(), (when || "").trim(), (description || "").trim()]
    );
    res.status(201).json({ game: toGame(rows[0]) });
  } catch (err) {
    next(err);
  }
});

router.put("/:id", requireRole("full"), async (req, res, next) => {
  try {
    const { name, when, description } = req.body || {};
    const { rows: existingRows } = await pool.query("SELECT * FROM games WHERE id = $1", [req.params.id]);
    if (!existingRows[0]) return res.status(404).json({ error: "Game not found." });
    const existing = existingRows[0];
    const nextName = name !== undefined ? name.trim() : existing.name;
    const nextWhen = when !== undefined ? when.trim() : existing.when_text;
    const nextDescription = description !== undefined ? description.trim() : existing.description;
    const { rows } = await pool.query(
      "UPDATE games SET name = $1, when_text = $2, description = $3 WHERE id = $4 RETURNING *",
      [nextName, nextWhen, nextDescription, req.params.id]
    );
    res.json({ game: toGame(rows[0]) });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireRole("full"), async (req, res, next) => {
  try {
    const { rowCount } = await pool.query("DELETE FROM games WHERE id = $1", [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: "Game not found." });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
