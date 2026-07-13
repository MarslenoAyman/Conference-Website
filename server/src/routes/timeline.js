import { Router } from "express";
import { randomUUID } from "crypto";
import { pool } from "../db/pool.js";
import { authenticate, requireRole } from "../auth.js";

const router = Router();
router.use(authenticate);

async function dayWithSessions(dayRow) {
  const { rows } = await pool.query(
    "SELECT id, time, title FROM timeline_sessions WHERE day_id = $1 ORDER BY created_at",
    [dayRow.id]
  );
  return { id: dayRow.id, day: dayRow.day_number, label: dayRow.label, sessions: rows };
}

router.get("/", async (req, res, next) => {
  try {
    const { rows: days } = await pool.query("SELECT * FROM timeline_days ORDER BY day_number");
    const { rows: sessions } = await pool.query("SELECT * FROM timeline_sessions ORDER BY created_at");
    const timeline = days.map((d) => ({
      id: d.id,
      day: d.day_number,
      label: d.label,
      sessions: sessions
        .filter((s) => s.day_id === d.id)
        .map((s) => ({ id: s.id, time: s.time, title: s.title })),
    }));
    res.json({ timeline });
  } catch (err) {
    next(err);
  }
});

router.post("/", requireRole("full"), async (req, res, next) => {
  try {
    const { label } = req.body || {};
    if (!label || !label.trim()) return res.status(400).json({ error: "Day label is required." });
    const { rows: countRows } = await pool.query("SELECT COUNT(*) FROM timeline_days");
    const dayNumber = Number(countRows[0].count) + 1;
    const { rows } = await pool.query(
      "INSERT INTO timeline_days (id, day_number, label) VALUES ($1, $2, $3) RETURNING *",
      [randomUUID(), dayNumber, label.trim()]
    );
    res.status(201).json({ day: await dayWithSessions(rows[0]) });
  } catch (err) {
    next(err);
  }
});

router.put("/:dayId", requireRole("full"), async (req, res, next) => {
  try {
    const { label } = req.body || {};
    if (!label || !label.trim()) return res.status(400).json({ error: "Day label is required." });
    const { rows } = await pool.query("UPDATE timeline_days SET label = $1 WHERE id = $2 RETURNING *", [
      label.trim(),
      req.params.dayId,
    ]);
    if (!rows[0]) return res.status(404).json({ error: "Day not found." });
    res.json({ day: await dayWithSessions(rows[0]) });
  } catch (err) {
    next(err);
  }
});

router.delete("/:dayId", requireRole("full"), async (req, res, next) => {
  try {
    const { rowCount } = await pool.query("DELETE FROM timeline_days WHERE id = $1", [req.params.dayId]);
    if (rowCount === 0) return res.status(404).json({ error: "Day not found." });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post("/:dayId/sessions", requireRole("full"), async (req, res, next) => {
  try {
    const { time, title } = req.body || {};
    if (!time || !title) return res.status(400).json({ error: "Time and session title are required." });
    const day = await pool.query("SELECT id FROM timeline_days WHERE id = $1", [req.params.dayId]);
    if (!day.rows[0]) return res.status(404).json({ error: "Day not found." });
    const { rows } = await pool.query(
      "INSERT INTO timeline_sessions (id, day_id, time, title) VALUES ($1, $2, $3, $4) RETURNING id, time, title",
      [randomUUID(), req.params.dayId, time.trim(), title.trim()]
    );
    res.status(201).json({ session: rows[0] });
  } catch (err) {
    next(err);
  }
});

router.delete("/:dayId/sessions/:sessionId", requireRole("full"), async (req, res, next) => {
  try {
    const { rowCount } = await pool.query(
      "DELETE FROM timeline_sessions WHERE id = $1 AND day_id = $2",
      [req.params.sessionId, req.params.dayId]
    );
    if (rowCount === 0) return res.status(404).json({ error: "Session not found." });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
