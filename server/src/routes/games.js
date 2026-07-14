import { Router } from "express";
import { randomUUID } from "crypto";
import { pool } from "../db/pool.js";
import { authenticate, requireRole } from "../auth.js";

const router = Router();
router.use(authenticate);

function toGame(row) {
  return {
    id: row.id,
    name: row.name,
    when: row.when_text,
    description: row.description,
    type: row.type,
    icon: row.icon,
    format: row.format,
    teamSize: row.team_size,
  };
}

async function rosterView(gameId) {
  const { rows: teams } = await pool.query("SELECT * FROM game_teams WHERE game_id = $1 ORDER BY name", [gameId]);
  const { rows: rosterRows } = await pool.query(
    `SELECT gr.team_id, u.id, u.name FROM game_rosters gr
     JOIN users u ON u.id = gr.user_id WHERE gr.game_id = $1`,
    [gameId]
  );
  return teams.map((t) => ({
    teamId: t.id,
    teamName: t.name,
    color: t.color,
    players: rosterRows.filter((r) => r.team_id === t.id).map((r) => ({ id: r.id, name: r.name })),
  }));
}

async function matchupView(gameId, format) {
  const { rows: matches } = await pool.query("SELECT * FROM matches WHERE game_id = $1 ORDER BY round, created_at", [
    gameId,
  ]);
  const matchIds = matches.map((m) => m.id);
  const { rows: playerRows } = matchIds.length
    ? await pool.query(
        `SELECT mp.match_id, mp.side, u.id, u.name FROM match_players mp
         JOIN users u ON u.id = mp.user_id WHERE mp.match_id = ANY($1::text[])`,
        [matchIds]
      )
    : { rows: [] };

  const matchList = matches.map((m) => ({
    id: m.id,
    round: m.round,
    status: m.status,
    winnerSide: m.winner_side,
    sideA: playerRows.filter((p) => p.match_id === m.id && p.side === "a").map((p) => ({ id: p.id, name: p.name })),
    sideB: playerRows.filter((p) => p.match_id === m.id && p.side === "b").map((p) => ({ id: p.id, name: p.name })),
  }));

  let standings = null;
  if (format === "league") {
    const tally = new Map();
    const bump = (p, field) => {
      const entry = tally.get(p.id) || { id: p.id, name: p.name, wins: 0, losses: 0 };
      entry[field] += 1;
      tally.set(p.id, entry);
    };
    for (const m of matchList) {
      if (m.status !== "done" || !m.winnerSide) continue;
      const winners = m.winnerSide === "a" ? m.sideA : m.sideB;
      const losers = m.winnerSide === "a" ? m.sideB : m.sideA;
      winners.forEach((p) => bump(p, "wins"));
      losers.forEach((p) => bump(p, "losses"));
    }
    standings = [...tally.values()].sort((a, b) => b.wins - a.wins || a.losses - b.losses);
  }

  return { matches: matchList, standings };
}

router.get("/", async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM games ORDER BY created_at");
    res.json({ games: rows.map(toGame) });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM games WHERE id = $1", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Game not found." });
    const game = toGame(rows[0]);
    if (game.type === "roster") {
      const rosters = await rosterView(game.id);
      game.rosters =
        req.user.role === "none"
          ? rosters.filter((r) => r.players.some((p) => p.id === req.user.id))
          : rosters;
    } else {
      const { matches, standings } = await matchupView(game.id, game.format);
      game.matches = matches;
      game.standings = standings;
    }
    res.json({ game });
  } catch (err) {
    next(err);
  }
});

router.post("/", requireRole("full"), async (req, res, next) => {
  try {
    const { name, when, description, type, icon, format, teamSize } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: "Game name is required." });
    const { rows } = await pool.query(
      `INSERT INTO games (id, name, when_text, description, type, icon, format, team_size)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        randomUUID(),
        name.trim(),
        (when || "").trim(),
        (description || "").trim(),
        type || "roster",
        icon || "ball",
        format || "league",
        Number(teamSize) === 2 ? 2 : 1,
      ]
    );
    res.status(201).json({ game: toGame(rows[0]) });
  } catch (err) {
    next(err);
  }
});

router.put("/:id", requireRole("full"), async (req, res, next) => {
  try {
    const { name, when, description, type, icon, format, teamSize } = req.body || {};
    const { rows: existingRows } = await pool.query("SELECT * FROM games WHERE id = $1", [req.params.id]);
    if (!existingRows[0]) return res.status(404).json({ error: "Game not found." });
    const existing = existingRows[0];
    const nextName = name !== undefined ? name.trim() : existing.name;
    const nextWhen = when !== undefined ? when.trim() : existing.when_text;
    const nextDescription = description !== undefined ? description.trim() : existing.description;
    const nextType = type !== undefined ? type : existing.type;
    const nextIcon = icon !== undefined ? icon : existing.icon;
    const nextFormat = format !== undefined ? format : existing.format;
    const nextTeamSize = teamSize !== undefined ? (Number(teamSize) === 2 ? 2 : 1) : existing.team_size;
    const { rows } = await pool.query(
      `UPDATE games SET name = $1, when_text = $2, description = $3, type = $4, icon = $5, format = $6, team_size = $7
       WHERE id = $8 RETURNING *`,
      [nextName, nextWhen, nextDescription, nextType, nextIcon, nextFormat, nextTeamSize, req.params.id]
    );
    res.json({ game: toGame(rows[0]) });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireRole("full"), async (req, res, next) => {
  try {
    const { rowCount } = await pool.query("DELETE FROM games WHERE id = $1", [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: "Game not found." });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/teams", requireRole("full"), async (req, res, next) => {
  try {
    const { name, color } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: "Team name is required." });
    await pool.query("INSERT INTO game_teams (id, game_id, name, color) VALUES ($1, $2, $3, $4)", [
      randomUUID(),
      req.params.id,
      name.trim(),
      color || "#5b6b4a",
    ]);
    res.status(201).json({ rosters: await rosterView(req.params.id) });
  } catch (err) {
    next(err);
  }
});

router.put("/:id/teams/:teamId", requireRole("full"), async (req, res, next) => {
  try {
    const { name, color } = req.body || {};
    const { rows: existingRows } = await pool.query("SELECT * FROM game_teams WHERE id = $1 AND game_id = $2", [
      req.params.teamId,
      req.params.id,
    ]);
    if (!existingRows[0]) return res.status(404).json({ error: "Team not found." });
    const existing = existingRows[0];
    const nextName = name !== undefined && name.trim() ? name.trim() : existing.name;
    const nextColor = color !== undefined ? color : existing.color;
    await pool.query("UPDATE game_teams SET name = $1, color = $2 WHERE id = $3", [
      nextName,
      nextColor,
      req.params.teamId,
    ]);
    res.json({ rosters: await rosterView(req.params.id) });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id/teams/:teamId", requireRole("full"), async (req, res, next) => {
  try {
    const { rowCount } = await pool.query("DELETE FROM game_teams WHERE id = $1 AND game_id = $2", [
      req.params.teamId,
      req.params.id,
    ]);
    if (rowCount === 0) return res.status(404).json({ error: "Team not found." });
    res.json({ rosters: await rosterView(req.params.id) });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/roster", requireRole("full"), async (req, res, next) => {
  try {
    const { teamId, userId } = req.body || {};
    if (!teamId || !userId) return res.status(400).json({ error: "A team and member are required." });
    const { rows: teamRows } = await pool.query("SELECT id FROM game_teams WHERE id = $1 AND game_id = $2", [
      teamId,
      req.params.id,
    ]);
    if (!teamRows[0]) return res.status(404).json({ error: "Team not found." });
    const { rows: userRows } = await pool.query("SELECT id FROM users WHERE id = $1", [userId]);
    if (!userRows[0]) return res.status(404).json({ error: "Member not found." });
    await pool.query(
      `INSERT INTO game_rosters (game_id, team_id, user_id) VALUES ($1, $2, $3)
       ON CONFLICT (game_id, user_id) DO UPDATE SET team_id = EXCLUDED.team_id`,
      [req.params.id, teamId, userId]
    );
    res.json({ rosters: await rosterView(req.params.id) });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id/roster/:userId", requireRole("full"), async (req, res, next) => {
  try {
    await pool.query("DELETE FROM game_rosters WHERE game_id = $1 AND user_id = $2", [
      req.params.id,
      req.params.userId,
    ]);
    res.json({ rosters: await rosterView(req.params.id) });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/matches", requireRole("full"), async (req, res, next) => {
  try {
    const { round, players } = req.body || {};
    if (!Array.isArray(players) || players.length < 2) {
      return res.status(400).json({ error: "At least two players are required." });
    }
    if (!players.every((p) => p.userId && (p.side === "a" || p.side === "b"))) {
      return res.status(400).json({ error: "Each player needs a valid side." });
    }
    const sides = new Set(players.map((p) => p.side));
    if (!sides.has("a") || !sides.has("b")) {
      return res.status(400).json({ error: "Both sides need at least one player." });
    }
    const matchId = randomUUID();
    await pool.query("INSERT INTO matches (id, game_id, round) VALUES ($1, $2, $3)", [
      matchId,
      req.params.id,
      Number(round) > 0 ? Number(round) : 1,
    ]);
    for (const p of players) {
      await pool.query("INSERT INTO match_players (match_id, user_id, side) VALUES ($1, $2, $3)", [
        matchId,
        p.userId,
        p.side,
      ]);
    }
    const { rows: gameRows } = await pool.query("SELECT format FROM games WHERE id = $1", [req.params.id]);
    res.status(201).json(await matchupView(req.params.id, gameRows[0]?.format));
  } catch (err) {
    next(err);
  }
});

router.put("/:id/matches/:matchId", requireRole("full"), async (req, res, next) => {
  try {
    const { winnerSide } = req.body || {};
    if (winnerSide === null) {
      await pool.query(
        "UPDATE matches SET status = 'scheduled', winner_side = NULL WHERE id = $1 AND game_id = $2",
        [req.params.matchId, req.params.id]
      );
    } else {
      if (winnerSide !== "a" && winnerSide !== "b") {
        return res.status(400).json({ error: "A valid winner is required." });
      }
      const { rowCount } = await pool.query(
        "UPDATE matches SET status = 'done', winner_side = $1 WHERE id = $2 AND game_id = $3",
        [winnerSide, req.params.matchId, req.params.id]
      );
      if (rowCount === 0) return res.status(404).json({ error: "Match not found." });
    }
    const { rows: gameRows } = await pool.query("SELECT format FROM games WHERE id = $1", [req.params.id]);
    res.json(await matchupView(req.params.id, gameRows[0]?.format));
  } catch (err) {
    next(err);
  }
});

router.delete("/:id/matches/:matchId", requireRole("full"), async (req, res, next) => {
  try {
    await pool.query("DELETE FROM matches WHERE id = $1 AND game_id = $2", [req.params.matchId, req.params.id]);
    const { rows: gameRows } = await pool.query("SELECT format FROM games WHERE id = $1", [req.params.id]);
    res.json(await matchupView(req.params.id, gameRows[0]?.format));
  } catch (err) {
    next(err);
  }
});

export default router;
