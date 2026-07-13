import { Router } from "express";
import { randomUUID } from "crypto";
import { pool } from "../db/pool.js";
import { authenticate, requireRole } from "../auth.js";

const router = Router();
router.use(authenticate);

async function allTeamsWithMembers() {
  const { rows: teams } = await pool.query("SELECT * FROM teams ORDER BY name");
  const { rows: users } = await pool.query("SELECT id, name, role, team_id FROM users");
  return teams.map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color,
    points: t.points,
    members: users
      .filter((u) => u.team_id === t.id)
      .map((u) => ({ id: u.id, name: u.name, role: u.role })),
  }));
}

async function teamWithMembers(teamId) {
  const { rows: teamRows } = await pool.query("SELECT * FROM teams WHERE id = $1", [teamId]);
  const team = teamRows[0];
  if (!team) return null;
  const { rows: members } = await pool.query(
    "SELECT id, name, role FROM users WHERE team_id = $1",
    [teamId]
  );
  return { id: team.id, name: team.name, color: team.color, points: team.points, members };
}

router.get("/", async (req, res, next) => {
  try {
    const teams = await allTeamsWithMembers();

    if (req.user.role === "none") {
      const own = teams.find((t) => t.members.some((m) => m.id === req.user.id));
      return res.json({ teams: own ? [own] : [], unassigned: [] });
    }

    const { rows: unassignedRows } = await pool.query(
      "SELECT id, name FROM users WHERE role = 'none' AND team_id IS NULL"
    );
    res.json({ teams, unassigned: unassignedRows });
  } catch (err) {
    next(err);
  }
});

router.post("/", requireRole("full"), async (req, res, next) => {
  try {
    const { name, color } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: "Team name is required." });
    const { rows } = await pool.query("INSERT INTO teams (id, name, color) VALUES ($1, $2, $3) RETURNING id", [
      randomUUID(),
      name.trim(),
      color || "#5b6b4a",
    ]);
    res.status(201).json({ team: await teamWithMembers(rows[0].id) });
  } catch (err) {
    next(err);
  }
});

router.put("/:id", requireRole("full"), async (req, res, next) => {
  try {
    const { name, color } = req.body || {};
    const { rows: existingRows } = await pool.query("SELECT * FROM teams WHERE id = $1", [req.params.id]);
    if (!existingRows[0]) return res.status(404).json({ error: "Team not found." });
    const existing = existingRows[0];
    const nextName = name !== undefined && name.trim() ? name.trim() : existing.name;
    const nextColor = color !== undefined ? color : existing.color;
    await pool.query("UPDATE teams SET name = $1, color = $2 WHERE id = $3", [nextName, nextColor, req.params.id]);
    res.json({ team: await teamWithMembers(req.params.id) });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireRole("full"), async (req, res, next) => {
  try {
    const { rowCount } = await pool.query("DELETE FROM teams WHERE id = $1", [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: "Team not found." });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/points", requireRole("full"), async (req, res, next) => {
  try {
    const change = Number((req.body || {}).delta);
    if (!Number.isFinite(change)) return res.status(400).json({ error: "A numeric point change is required." });
    const { rowCount } = await pool.query(
      "UPDATE teams SET points = GREATEST(0, points + $1) WHERE id = $2",
      [change, req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: "Team not found." });
    res.json({ team: await teamWithMembers(req.params.id) });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/assign", requireRole("full"), async (req, res, next) => {
  try {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: "A member is required." });
    const team = await pool.query("SELECT id FROM teams WHERE id = $1", [req.params.id]);
    if (!team.rows[0]) return res.status(404).json({ error: "Team not found." });
    const { rowCount } = await pool.query("UPDATE users SET team_id = $1 WHERE id = $2", [
      req.params.id,
      userId,
    ]);
    if (rowCount === 0) return res.status(404).json({ error: "Member not found." });
    res.json({ team: await teamWithMembers(req.params.id) });
  } catch (err) {
    next(err);
  }
});

router.post("/unassign", requireRole("full"), async (req, res, next) => {
  try {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: "A member is required." });
    const { rowCount } = await pool.query("UPDATE users SET team_id = NULL WHERE id = $1", [userId]);
    if (rowCount === 0) return res.status(404).json({ error: "Member not found." });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
