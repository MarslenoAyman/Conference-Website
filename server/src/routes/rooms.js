import { Router } from "express";
import { randomUUID } from "crypto";
import { pool } from "../db/pool.js";
import { authenticate, requireRole } from "../auth.js";

const router = Router();
router.use(authenticate);

async function allRoomsWithMembers() {
  const { rows: rooms } = await pool.query("SELECT * FROM rooms ORDER BY created_at");
  const { rows: users } = await pool.query("SELECT id, name, role, room_id FROM users");
  return rooms.map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color,
    members: users.filter((u) => u.room_id === r.id).map((u) => ({ id: u.id, name: u.name, role: u.role })),
  }));
}

async function roomWithMembers(roomId) {
  const { rows: roomRows } = await pool.query("SELECT * FROM rooms WHERE id = $1", [roomId]);
  const room = roomRows[0];
  if (!room) return null;
  const { rows: members } = await pool.query("SELECT id, name, role FROM users WHERE room_id = $1", [roomId]);
  return { id: room.id, name: room.name, color: room.color, members };
}

// Served members see only their own room (and roommates); full/limited see all.
router.get("/", async (req, res, next) => {
  try {
    const rooms = await allRoomsWithMembers();
    if (req.user.role === "none") {
      const own = rooms.find((r) => r.members.some((m) => m.id === req.user.id));
      return res.json({ rooms: own ? [own] : [], unassigned: [] });
    }
    const { rows: unassignedRows } = await pool.query(
      "SELECT id, name FROM users WHERE role = 'none' AND room_id IS NULL"
    );
    res.json({ rooms, unassigned: unassignedRows });
  } catch (err) {
    next(err);
  }
});

router.post("/", requireRole("full"), async (req, res, next) => {
  try {
    const { name, color } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: "A room number is required." });
    const { rows } = await pool.query("INSERT INTO rooms (id, name, color) VALUES ($1, $2, $3) RETURNING id", [
      randomUUID(),
      name.trim(),
      color || "#5b6b4a",
    ]);
    res.status(201).json({ room: await roomWithMembers(rows[0].id) });
  } catch (err) {
    next(err);
  }
});

router.put("/:id", requireRole("full"), async (req, res, next) => {
  try {
    const { name, color } = req.body || {};
    const { rows: existingRows } = await pool.query("SELECT * FROM rooms WHERE id = $1", [req.params.id]);
    if (!existingRows[0]) return res.status(404).json({ error: "Room not found." });
    const existing = existingRows[0];
    const nextName = name !== undefined && name.trim() ? name.trim() : existing.name;
    const nextColor = color !== undefined ? color : existing.color;
    await pool.query("UPDATE rooms SET name = $1, color = $2 WHERE id = $3", [nextName, nextColor, req.params.id]);
    res.json({ room: await roomWithMembers(req.params.id) });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireRole("full"), async (req, res, next) => {
  try {
    const { rowCount } = await pool.query("DELETE FROM rooms WHERE id = $1", [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: "Room not found." });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/assign", requireRole("full"), async (req, res, next) => {
  try {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: "A member is required." });
    const room = await pool.query("SELECT id FROM rooms WHERE id = $1", [req.params.id]);
    if (!room.rows[0]) return res.status(404).json({ error: "Room not found." });
    const { rowCount } = await pool.query("UPDATE users SET room_id = $1 WHERE id = $2", [req.params.id, userId]);
    if (rowCount === 0) return res.status(404).json({ error: "Member not found." });
    res.json({ room: await roomWithMembers(req.params.id) });
  } catch (err) {
    next(err);
  }
});

router.post("/unassign", requireRole("full"), async (req, res, next) => {
  try {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: "A member is required." });
    const { rowCount } = await pool.query("UPDATE users SET room_id = NULL WHERE id = $1", [userId]);
    if (rowCount === 0) return res.status(404).json({ error: "Member not found." });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
