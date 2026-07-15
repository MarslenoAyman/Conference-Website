import { Router } from "express";
import { randomUUID } from "crypto";
import { pool } from "../db/pool.js";
import { authenticate, requireRole } from "../auth.js";

const router = Router();
router.use(authenticate);

// A served member's own bonus view: their point total plus the history of
// changes to their own points (who gave them, why, and when). Any signed-in
// user can read this, but only ever for themselves.
router.get("/me", async (req, res, next) => {
  try {
    const { rows: userRows } = await pool.query("SELECT bonus FROM users WHERE id = $1", [req.user.id]);
    if (!userRows[0]) return res.status(404).json({ error: "Not found." });
    const { rows } = await pool.query(
      `SELECT bl.id, bl.delta, bl.reason, bl.created_at, actor.name AS actor_name
       FROM bonus_log bl
       LEFT JOIN users actor ON actor.id = bl.actor_id
       WHERE bl.user_id = $1
       ORDER BY bl.created_at DESC
       LIMIT 200`,
      [req.user.id]
    );
    res.json({
      bonus: userRows[0].bonus,
      history: rows.map((r) => ({
        id: r.id,
        delta: r.delta,
        reason: r.reason,
        createdAt: r.created_at,
        actorName: r.actor_name,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.get("/", requireRole("full", "limited"), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.phone, u.bonus, t.name AS team_name
       FROM users u
       LEFT JOIN teams t ON u.team_id = t.id
       WHERE u.role = 'none'
       ORDER BY u.bonus DESC, u.name`
    );
    res.json({
      members: rows.map((r) => ({ id: r.id, name: r.name, phone: r.phone, bonus: r.bonus, teamName: r.team_name })),
    });
  } catch (err) {
    next(err);
  }
});

router.get("/history", requireRole("full", "limited"), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT bl.id, bl.delta, bl.reason, bl.created_at, u.id AS user_id, u.name AS user_name,
              actor.name AS actor_name
       FROM bonus_log bl
       JOIN users u ON u.id = bl.user_id
       LEFT JOIN users actor ON actor.id = bl.actor_id
       ORDER BY bl.created_at DESC
       LIMIT 200`
    );
    res.json({
      history: rows.map((r) => ({
        id: r.id,
        userId: r.user_id,
        userName: r.user_name,
        delta: r.delta,
        reason: r.reason,
        createdAt: r.created_at,
        actorName: r.actor_name,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.post("/:userId", requireRole("full"), async (req, res, next) => {
  try {
    const { delta, reason } = req.body || {};
    const change = Number(delta);
    if (!Number.isFinite(change) || change === 0) {
      return res.status(400).json({ error: "A numeric point change is required." });
    }
    const { rows } = await pool.query(
      "UPDATE users SET bonus = GREATEST(0, bonus + $1) WHERE id = $2 RETURNING id, name, bonus",
      [change, req.params.userId]
    );
    if (!rows[0]) return res.status(404).json({ error: "Member not found." });
    await pool.query(
      "INSERT INTO bonus_log (id, user_id, delta, reason, actor_id) VALUES ($1, $2, $3, $4, $5)",
      [
        randomUUID(),
        req.params.userId,
        change,
        reason ? String(reason).trim().slice(0, 200) || null : null,
        req.user.id,
      ]
    );
    res.json({ member: rows[0] });
  } catch (err) {
    next(err);
  }
});

// Full-access servants can permanently delete a served (self-signed-up) account.
// Restricted to role='none' so servant accounts can never be removed here.
// FK cascades clean up the user's bonus log, rosters, goals, and match entries.
router.delete("/:userId", requireRole("full"), async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT id, role FROM users WHERE id = $1", [req.params.userId]);
    if (!rows[0]) return res.status(404).json({ error: "Member not found." });
    if (rows[0].role !== "none") {
      return res.status(403).json({ error: "Only served accounts can be deleted here." });
    }
    await pool.query("DELETE FROM users WHERE id = $1", [req.params.userId]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
