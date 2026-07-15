import { Router } from "express";
import { randomUUID } from "crypto";
import { pool } from "../db/pool.js";
import { authenticate } from "../auth.js";

// Record a site-wide notification. Every signed-in user polls for these and
// shows new ones as toast cards. kind: 'info' | 'warning'.
export async function notify(message, kind = "info") {
  await pool.query("INSERT INTO notifications (id, message, kind) VALUES ($1, $2, $3)", [
    randomUUID(),
    String(message).slice(0, 300),
    kind === "warning" ? "warning" : "info",
  ]);
}

const router = Router();
router.use(authenticate);

// GET /notifications?since=<iso> — notifications created after `since`
// (the client stores its last-seen time so each user only sees new ones once).
router.get("/", async (req, res, next) => {
  try {
    const since = req.query.since ? new Date(req.query.since) : null;
    const hasSince = since && !Number.isNaN(since.getTime());
    const { rows } = hasSince
      ? await pool.query(
          "SELECT id, message, kind, created_at FROM notifications WHERE created_at > $1 ORDER BY created_at DESC LIMIT 30",
          [since.toISOString()]
        )
      : await pool.query("SELECT id, message, kind, created_at FROM notifications ORDER BY created_at DESC LIMIT 30");
    res.json({
      notifications: rows.map((r) => ({ id: r.id, message: r.message, kind: r.kind, createdAt: r.created_at })),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
