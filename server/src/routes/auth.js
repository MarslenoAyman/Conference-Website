import { Router } from "express";
import { randomUUID } from "crypto";
import { pool } from "../db/pool.js";
import { authenticate, signToken } from "../auth.js";

const router = Router();

function publicUser(u) {
  return {
    id: u.id,
    name: u.name,
    phone: u.phone,
    role: u.role,
    teamId: u.team_id,
    bonus: u.bonus,
  };
}

router.post("/login", async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required." });
    }
    const { rows } = await pool.query("SELECT * FROM users WHERE lower(name) = lower($1)", [username.trim()]);
    const user = rows[0];
    if (!user || user.phone !== password.trim()) {
      return res.status(401).json({ error: "Username or password is incorrect." });
    }
    const token = signToken(publicUser(user));
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.post("/signup", async (req, res, next) => {
  try {
    const { name, phone } = req.body || {};
    if (!name || !phone) {
      return res.status(400).json({ error: "Name and phone number are required." });
    }
    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    if (!/^\d{8,15}$/.test(cleanPhone)) {
      return res.status(400).json({ error: "Enter a valid phone number." });
    }
    const existingPhone = await pool.query("SELECT id FROM users WHERE phone = $1", [cleanPhone]);
    if (existingPhone.rows.length > 0) {
      return res.status(409).json({ error: "An account with this phone number already exists." });
    }
    const existingName = await pool.query("SELECT id FROM users WHERE lower(name) = lower($1)", [cleanName]);
    if (existingName.rows.length > 0) {
      return res.status(409).json({ error: "This username is already taken, please use another." });
    }
    const { rows } = await pool.query(
      "INSERT INTO users (id, name, phone, role) VALUES ($1, $2, $3, 'none') RETURNING *",
      [randomUUID(), cleanName, cleanPhone]
    );
    const user = rows[0];
    const token = signToken(publicUser(user));
    res.status(201).json({ token, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.get("/me", authenticate, async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [req.user.id]);
    if (!rows[0]) return res.status(404).json({ error: "Account not found." });
    res.json({ user: publicUser(rows[0]) });
  } catch (err) {
    next(err);
  }
});

export default router;
