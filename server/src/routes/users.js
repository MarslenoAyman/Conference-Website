import { Router } from "express";
import { pool } from "../db/pool.js";
import { authenticate, requireRole } from "../auth.js";

const router = Router();
router.use(authenticate, requireRole("full", "limited"));

router.get("/", async (req, res, next) => {
  try {
    const isFull = req.user.role === "full";
    const { rows } = await pool.query(
      "SELECT id, name, phone, role, team_id, room_id, bonus FROM users ORDER BY name"
    );
    res.json({
      // Limited servants can list members (to run the game/team they manage) but
      // never see phone numbers — those double as staff passwords.
      users: rows.map((u) => ({
        id: u.id,
        name: u.name,
        phone: isFull ? u.phone : "",
        role: u.role,
        teamId: u.team_id,
        roomId: u.room_id,
        bonus: u.bonus,
      })),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
