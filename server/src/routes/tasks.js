import { Router } from "express";
import { randomUUID } from "crypto";
import { pool } from "../db/pool.js";
import { authenticate, requireRole } from "../auth.js";
import { notify } from "./notifications.js";

const router = Router();
router.use(authenticate);

function toTask(row, finishers) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    points: row.points,
    durationSeconds: row.duration_seconds,
    launchedAt: row.launched_at,
    finishers: finishers || [],
  };
}

async function finishersFor(taskId) {
  const { rows } = await pool.query(
    "SELECT u.id, u.name FROM task_completions tc JOIN users u ON u.id = tc.user_id WHERE tc.task_id = $1 ORDER BY u.name",
    [taskId]
  );
  return rows;
}

// Everyone signed in can read the task list (served see it read-only).
router.get("/", async (req, res, next) => {
  try {
    const { rows: tasks } = await pool.query("SELECT * FROM tasks ORDER BY created_at DESC");
    const { rows: comps } = await pool.query(
      "SELECT tc.task_id, u.id, u.name FROM task_completions tc JOIN users u ON u.id = tc.user_id ORDER BY u.name"
    );
    const byTask = {};
    for (const c of comps) (byTask[c.task_id] ||= []).push({ id: c.id, name: c.name });
    res.json({ tasks: tasks.map((t) => toTask(t, byTask[t.id])) });
  } catch (err) {
    next(err);
  }
});

router.post("/", requireRole("full"), async (req, res, next) => {
  try {
    const { title, description, points, durationSeconds } = req.body || {};
    if (!title || !title.trim()) return res.status(400).json({ error: "A task title is required." });
    const { rows } = await pool.query(
      "INSERT INTO tasks (id, title, description, points, duration_seconds) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [
        randomUUID(),
        title.trim(),
        (description || "").trim(),
        Math.max(0, parseInt(points, 10) || 0),
        Math.max(0, parseInt(durationSeconds, 10) || 0),
      ]
    );
    await notify(`New task: ${rows[0].title}`, "info");
    res.status(201).json({ task: toTask(rows[0], []) });
  } catch (err) {
    next(err);
  }
});

router.put("/:id", requireRole("full"), async (req, res, next) => {
  try {
    const { title, description, points, durationSeconds } = req.body || {};
    const { rows: existing } = await pool.query("SELECT * FROM tasks WHERE id = $1", [req.params.id]);
    if (!existing[0]) return res.status(404).json({ error: "Task not found." });
    const e = existing[0];
    const { rows } = await pool.query(
      "UPDATE tasks SET title = $1, description = $2, points = $3, duration_seconds = $4 WHERE id = $5 RETURNING *",
      [
        title !== undefined && title.trim() ? title.trim() : e.title,
        description !== undefined ? description.trim() : e.description,
        points !== undefined ? Math.max(0, parseInt(points, 10) || 0) : e.points,
        durationSeconds !== undefined ? Math.max(0, parseInt(durationSeconds, 10) || 0) : e.duration_seconds,
        req.params.id,
      ]
    );
    res.json({ task: toTask(rows[0], await finishersFor(req.params.id)) });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireRole("full"), async (req, res, next) => {
  try {
    const { rowCount } = await pool.query("DELETE FROM tasks WHERE id = $1", [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: "Task not found." });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Launch — (re)start the countdown from now and notify everyone.
router.post("/:id/launch", requireRole("full"), async (req, res, next) => {
  try {
    const { rows } = await pool.query("UPDATE tasks SET launched_at = now() WHERE id = $1 RETURNING *", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Task not found." });
    const secs = rows[0].duration_seconds || 0;
    const timeText = secs ? ` — ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}` : "";
    await notify(`Task launched: ${rows[0].title}${timeText}`, "warning");
    res.json({ task: toTask(rows[0], await finishersFor(req.params.id)) });
  } catch (err) {
    next(err);
  }
});

// Mark a served member as having finished — award the task's points to their Bonus.
router.post("/:id/complete", requireRole("full"), async (req, res, next) => {
  try {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: "A member is required." });
    const { rows: taskRows } = await pool.query("SELECT * FROM tasks WHERE id = $1", [req.params.id]);
    if (!taskRows[0]) return res.status(404).json({ error: "Task not found." });
    const { rows: userRows } = await pool.query("SELECT id, role FROM users WHERE id = $1", [userId]);
    if (!userRows[0]) return res.status(404).json({ error: "Member not found." });
    if (userRows[0].role !== "none") {
      return res.status(400).json({ error: "Only served members can finish tasks." });
    }
    const { rowCount } = await pool.query(
      "INSERT INTO task_completions (task_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [req.params.id, userId]
    );
    if (rowCount > 0 && taskRows[0].points > 0) {
      await pool.query("UPDATE users SET bonus = GREATEST(0, bonus + $1) WHERE id = $2", [taskRows[0].points, userId]);
      await pool.query("INSERT INTO bonus_log (id, user_id, delta, reason, actor_id) VALUES ($1, $2, $3, $4, $5)", [
        randomUUID(),
        userId,
        taskRows[0].points,
        `Task: ${taskRows[0].title}`.slice(0, 200),
        req.user.id,
      ]);
    }
    res.json({ task: toTask(taskRows[0], await finishersFor(req.params.id)) });
  } catch (err) {
    next(err);
  }
});

// Un-mark a finisher — reverse the points award.
router.delete("/:id/complete/:userId", requireRole("full"), async (req, res, next) => {
  try {
    const { rows: taskRows } = await pool.query("SELECT * FROM tasks WHERE id = $1", [req.params.id]);
    if (!taskRows[0]) return res.status(404).json({ error: "Task not found." });
    const { rowCount } = await pool.query("DELETE FROM task_completions WHERE task_id = $1 AND user_id = $2", [
      req.params.id,
      req.params.userId,
    ]);
    if (rowCount > 0 && taskRows[0].points > 0) {
      await pool.query("UPDATE users SET bonus = GREATEST(0, bonus - $1) WHERE id = $2", [
        taskRows[0].points,
        req.params.userId,
      ]);
      await pool.query("INSERT INTO bonus_log (id, user_id, delta, reason, actor_id) VALUES ($1, $2, $3, $4, $5)", [
        randomUUID(),
        req.params.userId,
        -taskRows[0].points,
        `Task removed: ${taskRows[0].title}`.slice(0, 200),
        req.user.id,
      ]);
    }
    res.json({ task: toTask(taskRows[0], await finishersFor(req.params.id)) });
  } catch (err) {
    next(err);
  }
});

export default router;
