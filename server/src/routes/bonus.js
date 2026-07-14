import { Router } from "express";
import { randomUUID } from "crypto";
import { pool } from "../db/pool.js";
import { authenticate, requireRole } from "../auth.js";

const router = Router();
router.use(authenticate, requireRole("full"));

router.get("/", async (req, res, next) => {
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

router.post("/:userId", async (req, res, next) => {
  try {
    const { delta, reason } = req.body || {};
    const change = Number(delta);
    if (!Number.isFinite(change)) return res.status(400).json({ error: "A numeric point change is required." });
    const { rows } = await pool.query(
      "UPDATE users SET bonus = GREATEST(0, bonus + $1) WHERE id = $2 RETURNING id, name, bonus",
      [change, req.params.userId]
    );
    if (!rows[0]) return res.status(404).json({ error: "Member not found." });
    await pool.query("INSERT INTO bonus_log (id, user_id, delta, reason) VALUES ($1, $2, $3, $4)", [
      randomUUID(),
      req.params.userId,
      change,
      reason ? String(reason).trim().slice(0, 200) || null : null,
    ]);
    res.json({ member: rows[0] });
  } catch (err) {
    next(err);
  }
});

export default router;
