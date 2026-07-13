import { Router } from "express";
import { pool } from "../db/pool.js";
import { authenticate, requireRole } from "../auth.js";

const router = Router();
router.use(authenticate, requireRole("full"));

router.get("/", async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, name, phone, role, team_id, bonus FROM users ORDER BY name"
    );
    res.json({
      users: rows.map((u) => ({
        id: u.id,
        name: u.name,
        phone: u.phone,
        role: u.role,
        teamId: u.team_id,
        bonus: u.bonus,
      })),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
