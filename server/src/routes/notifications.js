import { Router } from "express";
import { randomUUID } from "crypto";
import { pool } from "../db/pool.js";
import { authenticate, requireRole } from "../auth.js";

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

// GET /notifications — the current user's UNSEEN notifications (created after
// their server-side watermark). Guarantees offline users still get them on
// their next visit. The first call establishes the watermark (returns none).
router.get("/", async (req, res, next) => {
  try {
    const { rows: u } = await pool.query("SELECT notifications_seen_at FROM users WHERE id = $1", [req.user.id]);
    const seenAt = u[0]?.notifications_seen_at;
    if (!seenAt) {
      await pool.query("UPDATE users SET notifications_seen_at = now() WHERE id = $1", [req.user.id]);
      return res.json({ notifications: [] });
    }
    const { rows } = await pool.query(
      "SELECT id, message, kind, created_at FROM notifications WHERE created_at > $1 ORDER BY created_at LIMIT 50",
      [seenAt]
    );
    res.json({
      notifications: rows.map((r) => ({ id: r.id, message: r.message, kind: r.kind, createdAt: r.created_at })),
    });
  } catch (err) {
    next(err);
  }
});

// Advance the user's watermark once the client has shown the notifications, so
// each is shown exactly once (never re-shown, never skipped).
router.post("/seen", async (req, res, next) => {
  try {
    const ts = req.body?.at ? new Date(req.body.at) : new Date();
    if (Number.isNaN(ts.getTime())) return res.status(400).json({ error: "Invalid timestamp." });
    await pool.query(
      "UPDATE users SET notifications_seen_at = GREATEST(COALESCE(notifications_seen_at, to_timestamp(0)), $1) WHERE id = $2",
      [ts.toISOString(), req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Full-access only: purge every queued notification (e.g. leftovers from
// testing) so they stop popping up for anyone who hasn't seen them yet.
router.delete("/", requireRole("full"), async (req, res, next) => {
  try {
    await pool.query("DELETE FROM notifications");
    // Move everyone's watermark to now so nothing lingering is re-shown.
    await pool.query("UPDATE users SET notifications_seen_at = now()");
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
