import { Router } from "express";
import { randomUUID } from "crypto";
import { pool } from "../db/pool.js";
import { authenticate, requireRole } from "../auth.js";
import { notify } from "./notifications.js";

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
    manager: row.manager || "",
    fixturesReady: row.fixtures_ready || false,
    allServedView: row.all_served_view || false,
    singlesOnly: row.singles_only || false,
  };
}

async function cardsView(gameId) {
  const { rows } = await pool.query(
    "SELECT id, title, subtitle, art FROM game_cards WHERE game_id = $1 ORDER BY sort, created_at",
    [gameId]
  );
  return rows.map((c) => ({ id: c.id, title: c.title, subtitle: c.subtitle, art: c.art }));
}

// Play Station entries: each game_pair is one competitor — a single player or a
// multi (2-player) team, mixed freely in the same competition.
async function stationEntries(gameId) {
  const { rows } = await pool.query(
    `SELECT gp.id, u1.id AS p1_id, u1.name AS p1_name, u2.id AS p2_id, u2.name AS p2_name
     FROM game_pairs gp
     JOIN users u1 ON u1.id = gp.player1_id
     LEFT JOIN users u2 ON u2.id = gp.player2_id
     WHERE gp.game_id = $1
     ORDER BY gp.created_at`,
    [gameId]
  );
  return rows.map((r) => {
    const players = [{ id: r.p1_id, name: r.p1_name }];
    if (r.p2_id) players.push({ id: r.p2_id, name: r.p2_name });
    return { id: r.id, mode: r.p2_id ? "multi" : "single", players };
  });
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

// ---- Team-vs-team competition (roster games: Football etc.) ----

function nextPow2(n) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

// Standard single-elimination seed order (1-indexed) for a power-of-two size,
// so byes land against top seeds instead of clustering into empty matches.
function seedOrder(size) {
  let seeds = [1, 2];
  while (seeds.length < size) {
    const sum = seeds.length * 2 + 1;
    const next = [];
    for (const s of seeds) {
      next.push(s);
      next.push(sum - s);
    }
    seeds = next;
  }
  return seeds;
}

// View for a roster game's competition: team-vs-team matches + (league) standings.
async function competitionView(gameId, format) {
  const { rows: teams } = await pool.query("SELECT id, name FROM game_teams WHERE game_id = $1", [gameId]);
  const teamById = Object.fromEntries(teams.map((t) => [t.id, t]));
  const side = (teamId) => (teamId && teamById[teamId] ? [{ id: teamId, name: teamById[teamId].name }] : []);

  const { rows: matches } = await pool.query(
    "SELECT * FROM matches WHERE game_id = $1 ORDER BY round, bracket_pos, created_at",
    [gameId]
  );
  const { rows: goals } = await pool.query(
    `SELECT mg.match_id, mg.user_id, mg.team_id, u.name FROM match_goals mg
     JOIN users u ON u.id = mg.user_id WHERE mg.game_id = $1`,
    [gameId]
  );
  const scorersFor = (matchId, teamId) =>
    goals.filter((g) => g.match_id === matchId && g.team_id === teamId).map((g) => ({ id: g.user_id, name: g.name }));

  const matchList = matches.map((m) => ({
    id: m.id,
    round: m.round,
    status: m.status,
    winnerSide: m.winner_side,
    scoreA: m.score_a,
    scoreB: m.score_b,
    redA: m.red_a,
    yellowA: m.yellow_a,
    redB: m.red_b,
    yellowB: m.yellow_b,
    sideA: side(m.team_a_id),
    sideB: side(m.team_b_id),
    scorersA: scorersFor(m.id, m.team_a_id),
    scorersB: scorersFor(m.id, m.team_b_id),
  }));

  let standings = null;
  if (format === "league") {
    const tally = new Map();
    for (const t of teams)
      tally.set(t.id, {
        id: t.id,
        name: t.name,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        gf: 0,
        ga: 0,
        red: 0,
        yellow: 0,
        points: 0,
      });
    for (const m of matches) {
      if (m.status !== "done" || m.score_a === null || m.score_b === null) continue;
      const A = tally.get(m.team_a_id);
      const B = tally.get(m.team_b_id);
      if (!A || !B) continue;
      A.played += 1;
      B.played += 1;
      A.gf += m.score_a;
      A.ga += m.score_b;
      B.gf += m.score_b;
      B.ga += m.score_a;
      A.red += m.red_a;
      A.yellow += m.yellow_a;
      B.red += m.red_b;
      B.yellow += m.yellow_b;
      if (m.score_a > m.score_b) {
        A.wins += 1;
        A.points += 3;
        B.losses += 1;
      } else if (m.score_b > m.score_a) {
        B.wins += 1;
        B.points += 3;
        A.losses += 1;
      } else {
        A.draws += 1;
        B.draws += 1;
        A.points += 1;
        B.points += 1;
      }
    }
    standings = [...tally.values()]
      .map((t) => ({ ...t, gd: t.gf - t.ga }))
      .sort(
        (a, b) =>
          b.points - a.points || b.gd - a.gd || a.red - b.red || a.yellow - b.yellow || a.name.localeCompare(b.name)
      );
  }

  return { matches: matchList, standings };
}

// Goal-scorers sheet: banked (past competitions) + live goals, per served, ranked.
async function scorerSheet(gameId) {
  const { rows } = await pool.query(
    `SELECT u.id, u.name, COALESCE(pg.goals, 0) + COALESCE(mg.cnt, 0) AS goals
     FROM users u
     LEFT JOIN player_goals pg ON pg.user_id = u.id AND pg.game_id = $1
     LEFT JOIN (
       SELECT user_id, COUNT(*)::int AS cnt FROM match_goals WHERE game_id = $1 GROUP BY user_id
     ) mg ON mg.user_id = u.id
     WHERE COALESCE(pg.goals, 0) + COALESCE(mg.cnt, 0) > 0
     ORDER BY goals DESC, u.name`,
    [gameId]
  );
  return rows.map((r) => ({ id: r.id, name: r.name, goals: Number(r.goals) }));
}

// competitionView plus the persistent scorer sheet.
async function withScorers(gameId, format) {
  const view = await competitionView(gameId, format);
  view.scorers = await scorerSheet(gameId);
  return view;
}

// Fold the current competition's live goals into the persistent per-player tally.
async function bankGoals(gameId) {
  await pool.query(
    `INSERT INTO player_goals (game_id, user_id, goals)
     SELECT game_id, user_id, COUNT(*) FROM match_goals WHERE game_id = $1 GROUP BY game_id, user_id
     ON CONFLICT (game_id, user_id) DO UPDATE SET goals = player_goals.goals + EXCLUDED.goals`,
    [gameId]
  );
}

// Push cup winners into the next bracket round (recomputed from scratch, so
// resetting a result correctly clears everything downstream of it).
async function recomputeBracket(gameId) {
  const { rows: matches } = await pool.query(
    "SELECT * FROM matches WHERE game_id = $1 ORDER BY round, bracket_pos",
    [gameId]
  );
  const byId = Object.fromEntries(matches.map((m) => [m.id, m]));
  // Clear every slot that is fed by a previous match (round-1 seeds are never targets).
  for (const m of matches) {
    const target = m.next_match_id && byId[m.next_match_id];
    if (!target) continue;
    if (m.next_slot === "a") target.team_a_id = null;
    else if (m.next_slot === "b") target.team_b_id = null;
  }
  // Propagate decided winners forward, round by round.
  for (const m of matches) {
    if (m.status !== "done" || !m.winner_side) continue;
    const target = m.next_match_id && byId[m.next_match_id];
    if (!target) continue;
    const winId = m.winner_side === "a" ? m.team_a_id : m.team_b_id;
    if (m.next_slot === "a") target.team_a_id = winId;
    else if (m.next_slot === "b") target.team_b_id = winId;
  }
  for (const m of matches) {
    await pool.query("UPDATE matches SET team_a_id = $1, team_b_id = $2 WHERE id = $3", [
      m.team_a_id,
      m.team_b_id,
      m.id,
    ]);
  }
}

// Clear a roster game's fixtures (called when its team set changes). Goals are
// banked first so the scorer sheet is never lost.
async function resetFixtures(gameId) {
  await bankGoals(gameId);
  await pool.query("DELETE FROM matches WHERE game_id = $1", [gameId]);
  await pool.query("UPDATE games SET fixtures_ready = false WHERE id = $1", [gameId]);
}

// Build League (round-robin) or Cup (single-elimination) fixtures for a roster game.
async function generateFixtures(gameId, format) {
  await bankGoals(gameId);
  await pool.query("DELETE FROM matches WHERE game_id = $1", [gameId]);
  const { rows: teams } = await pool.query("SELECT id FROM game_teams WHERE game_id = $1 ORDER BY name", [gameId]);
  const teamIds = teams.map((t) => t.id);

  if (format === "league") {
    let pos = 0;
    for (let i = 0; i < teamIds.length; i++) {
      for (let j = i + 1; j < teamIds.length; j++) {
        await pool.query(
          "INSERT INTO matches (id, game_id, round, team_a_id, team_b_id, bracket_pos) VALUES ($1, $2, 1, $3, $4, $5)",
          [randomUUID(), gameId, teamIds[i], teamIds[j], pos++]
        );
      }
    }
    return;
  }

  // Cup bracket.
  const n = teamIds.length;
  const size = nextPow2(n);
  const order = seedOrder(size);
  const slots = order.map((rank) => (rank <= n ? teamIds[rank - 1] : null));
  const roundCount = Math.log2(size);

  const rounds = [];
  for (let r = 0; r < roundCount; r++) {
    const count = size / Math.pow(2, r + 1);
    rounds.push(Array.from({ length: count }, () => randomUUID()));
  }
  // Insert final round first so earlier rounds can reference next_match_id.
  for (let r = roundCount - 1; r >= 0; r--) {
    const ids = rounds[r];
    for (let k = 0; k < ids.length; k++) {
      const nextId = r < roundCount - 1 ? rounds[r + 1][Math.floor(k / 2)] : null;
      const nextSlot = r < roundCount - 1 ? (k % 2 === 0 ? "a" : "b") : null;
      const teamA = r === 0 ? slots[2 * k] || null : null;
      const teamB = r === 0 ? slots[2 * k + 1] || null : null;
      await pool.query(
        `INSERT INTO matches (id, game_id, round, team_a_id, team_b_id, next_match_id, next_slot, bracket_pos)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [ids[k], gameId, r + 1, teamA, teamB, nextId, nextSlot, k]
      );
    }
  }
  // Auto-advance byes (a round-1 match with only one team).
  for (let k = 0; k < rounds[0].length; k++) {
    const a = slots[2 * k] || null;
    const b = slots[2 * k + 1] || null;
    if (a && !b) await pool.query("UPDATE matches SET status = 'done', winner_side = 'a' WHERE id = $1", [rounds[0][k]]);
    else if (b && !a) await pool.query("UPDATE matches SET status = 'done', winner_side = 'b' WHERE id = $1", [rounds[0][k]]);
  }
  await recomputeBracket(gameId);
}

// ---- Individual-player competition (Chess): pool + random fixtures ----

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// View for a player game's competition: competitor (single or pair) matches +
// (league) win standings. A competitor is a game_pairs row: one player for
// singles, two for doubles. Match sides are arrays of the competitor's players
// so the shared MatchCard shows "A" or "A & B".
async function playerCompetitionView(gameId, format) {
  const { rows: pairs } = await pool.query(
    `SELECT gp.id, u1.id AS p1_id, u1.name AS p1_name, u2.id AS p2_id, u2.name AS p2_name
     FROM game_pairs gp
     JOIN users u1 ON u1.id = gp.player1_id
     LEFT JOIN users u2 ON u2.id = gp.player2_id
     WHERE gp.game_id = $1`,
    [gameId]
  );
  const pairById = {};
  for (const p of pairs) {
    const players = [{ id: p.p1_id, name: p.p1_name }];
    if (p.p2_id) players.push({ id: p.p2_id, name: p.p2_name });
    pairById[p.id] = { name: players.map((x) => x.name).join(" & "), players };
  }
  const side = (pairId) => (pairId && pairById[pairId] ? pairById[pairId].players : []);

  const { rows: matches } = await pool.query(
    "SELECT * FROM matches WHERE game_id = $1 ORDER BY round, bracket_pos, created_at",
    [gameId]
  );
  const matchList = matches.map((m) => ({
    id: m.id,
    round: m.round,
    status: m.status,
    winnerSide: m.winner_side,
    sideA: side(m.pair_a_id),
    sideB: side(m.pair_b_id),
  }));

  let standings = null;
  if (format === "league") {
    const tally = new Map();
    for (const p of pairs) tally.set(p.id, { id: p.id, name: pairById[p.id].name, played: 0, wins: 0, losses: 0 });
    for (const m of matches) {
      if (m.status !== "done" || !m.winner_side) continue;
      const winId = m.winner_side === "a" ? m.pair_a_id : m.pair_b_id;
      const loseId = m.winner_side === "a" ? m.pair_b_id : m.pair_a_id;
      if (winId && tally.has(winId)) {
        tally.get(winId).wins += 1;
        tally.get(winId).played += 1;
      }
      if (loseId && tally.has(loseId)) {
        tally.get(loseId).losses += 1;
        tally.get(loseId).played += 1;
      }
    }
    standings = [...tally.values()].sort(
      (a, b) => b.wins - a.wins || a.losses - b.losses || a.name.localeCompare(b.name)
    );
  }
  return { matches: matchList, standings };
}

// Advance cup winners into the next round's competitor slots (recomputed fresh).
async function recomputePlayerBracket(gameId) {
  const { rows: matches } = await pool.query(
    "SELECT * FROM matches WHERE game_id = $1 ORDER BY round, bracket_pos",
    [gameId]
  );
  const byId = Object.fromEntries(matches.map((m) => [m.id, m]));
  for (const m of matches) {
    const target = m.next_match_id && byId[m.next_match_id];
    if (!target) continue;
    if (m.next_slot === "a") target.pair_a_id = null;
    else if (m.next_slot === "b") target.pair_b_id = null;
  }
  for (const m of matches) {
    if (m.status !== "done" || !m.winner_side) continue;
    const target = m.next_match_id && byId[m.next_match_id];
    if (!target) continue;
    const winId = m.winner_side === "a" ? m.pair_a_id : m.pair_b_id;
    if (m.next_slot === "a") target.pair_a_id = winId;
    else if (m.next_slot === "b") target.pair_b_id = winId;
  }
  for (const m of matches) {
    await pool.query("UPDATE matches SET pair_a_id = $1, pair_b_id = $2 WHERE id = $3", [
      m.pair_a_id,
      m.pair_b_id,
      m.id,
    ]);
  }
}

async function resetPlayerFixtures(gameId) {
  await pool.query("DELETE FROM matches WHERE game_id = $1", [gameId]);
  await pool.query("DELETE FROM game_pairs WHERE game_id = $1", [gameId]);
  await pool.query("UPDATE games SET fixtures_ready = false WHERE id = $1", [gameId]);
}

async function playerPool(gameId) {
  const { rows } = await pool.query(
    "SELECT gp.user_id AS id, u.name FROM game_players gp JOIN users u ON u.id = gp.user_id WHERE gp.game_id = $1 ORDER BY u.name",
    [gameId]
  );
  return rows;
}

// Royal Rumble ring: global teams in the ring, with points + elimination.
async function rumbleRing(gameId) {
  const { rows } = await pool.query(
    `SELECT t.id, t.name, t.color, t.points, grt.eliminated
     FROM game_rumble_teams grt JOIN teams t ON t.id = grt.team_id
     WHERE grt.game_id = $1 ORDER BY grt.eliminated, grt.created_at`,
    [gameId]
  );
  return rows.map((r) => ({ id: r.id, name: r.name, color: r.color, points: r.points, eliminated: r.eliminated }));
}

async function rumbleTasks(gameId) {
  const { rows } = await pool.query(
    "SELECT id, title, instructions, points, duration_seconds, launched_at FROM game_tasks WHERE game_id = $1 ORDER BY created_at",
    [gameId]
  );
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    instructions: r.instructions,
    points: r.points,
    durationSeconds: r.duration_seconds,
    launchedAt: r.launched_at,
  }));
}

// Survival board (Squid Game): picked players with their elimination state.
async function survivalPlayers(gameId) {
  const { rows } = await pool.query(
    `SELECT gp.user_id AS id, u.name, gp.eliminated FROM game_players gp
     JOIN users u ON u.id = gp.user_id WHERE gp.game_id = $1 ORDER BY gp.eliminated, u.name`,
    [gameId]
  );
  return rows.map((r) => ({ id: r.id, name: r.name, eliminated: r.eliminated }));
}

// Form the competitor list: singles = one game_pair per player; doubles = players
// shuffled and paired two at a time (a leftover odd player becomes a solo pair).
async function buildPlayerPairs(gameId, teamSize) {
  await pool.query("DELETE FROM game_pairs WHERE game_id = $1", [gameId]);
  const { rows } = await pool.query("SELECT user_id FROM game_players WHERE game_id = $1", [gameId]);
  const players = shuffle(rows.map((r) => r.user_id));
  const pairIds = [];
  if (teamSize === 2) {
    for (let i = 0; i < players.length; i += 2) {
      const id = randomUUID();
      await pool.query("INSERT INTO game_pairs (id, game_id, player1_id, player2_id) VALUES ($1, $2, $3, $4)", [
        id,
        gameId,
        players[i],
        players[i + 1] || null,
      ]);
      pairIds.push(id);
    }
  } else {
    for (const p of players) {
      const id = randomUUID();
      await pool.query("INSERT INTO game_pairs (id, game_id, player1_id, player2_id) VALUES ($1, $2, $3, NULL)", [
        id,
        gameId,
        p,
      ]);
      pairIds.push(id);
    }
  }
  return shuffle(pairIds);
}

// Build randomised League (round-robin) or Cup (single-elimination) fixtures
// between the competitors (singles players or doubles pairs).
async function generatePlayerFixtures(gameId, format, teamSize) {
  await pool.query("DELETE FROM matches WHERE game_id = $1", [gameId]);
  const ids = await buildPlayerPairs(gameId, teamSize);
  await buildFixturesFromPairs(gameId, format, ids);
}

// Play Station-style games: entries (game_pairs) are built manually by the
// manager (each a single player or a multi pair), so generate fixtures over the
// existing entries without rebuilding them.
async function generateStationFixtures(gameId, format) {
  await pool.query("DELETE FROM matches WHERE game_id = $1", [gameId]);
  const { rows } = await pool.query("SELECT id FROM game_pairs WHERE game_id = $1", [gameId]);
  await buildFixturesFromPairs(gameId, format, shuffle(rows.map((r) => r.id)));
}

// Given the competitor pair ids, lay out League (round-robin) or Cup
// (single-elimination) matches between them.
async function buildFixturesFromPairs(gameId, format, ids) {
  if (format === "league") {
    let pos = 0;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        await pool.query(
          "INSERT INTO matches (id, game_id, round, pair_a_id, pair_b_id, bracket_pos) VALUES ($1, $2, 1, $3, $4, $5)",
          [randomUUID(), gameId, ids[i], ids[j], pos++]
        );
      }
    }
    return;
  }

  const n = ids.length;
  const size = nextPow2(n);
  const order = seedOrder(size);
  const slots = order.map((rank) => (rank <= n ? ids[rank - 1] : null));
  const roundCount = Math.log2(size);

  const rounds = [];
  for (let r = 0; r < roundCount; r++) {
    const count = size / Math.pow(2, r + 1);
    rounds.push(Array.from({ length: count }, () => randomUUID()));
  }
  for (let r = roundCount - 1; r >= 0; r--) {
    const rIds = rounds[r];
    for (let k = 0; k < rIds.length; k++) {
      const nextId = r < roundCount - 1 ? rounds[r + 1][Math.floor(k / 2)] : null;
      const nextSlot = r < roundCount - 1 ? (k % 2 === 0 ? "a" : "b") : null;
      const pA = r === 0 ? slots[2 * k] || null : null;
      const pB = r === 0 ? slots[2 * k + 1] || null : null;
      await pool.query(
        `INSERT INTO matches (id, game_id, round, pair_a_id, pair_b_id, next_match_id, next_slot, bracket_pos)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [rIds[k], gameId, r + 1, pA, pB, nextId, nextSlot, k]
      );
    }
  }
  for (let k = 0; k < rounds[0].length; k++) {
    const a = slots[2 * k] || null;
    const b = slots[2 * k + 1] || null;
    if (a && !b) await pool.query("UPDATE matches SET status = 'done', winner_side = 'a' WHERE id = $1", [rounds[0][k]]);
    else if (b && !a) await pool.query("UPDATE matches SET status = 'done', winner_side = 'b' WHERE id = $1", [rounds[0][k]]);
  }
  await recomputePlayerBracket(gameId);
}

router.get("/", async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM games ORDER BY created_at");
    res.json({ games: rows.map(toGame) });
  } catch (err) {
    next(err);
  }
});

// Is this served member signed into the game (on a roster or in the player pool)?
async function isServedParticipant(gameId, userId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM game_rosters WHERE game_id = $1 AND user_id = $2
     UNION ALL
     SELECT 1 FROM game_players WHERE game_id = $1 AND user_id = $2
     UNION ALL
     SELECT 1 FROM game_pairs WHERE game_id = $1 AND ($2 IN (player1_id, player2_id))
     LIMIT 1`,
    [gameId, userId]
  );
  return rows.length > 0;
}

router.get("/:id", async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM games WHERE id = $1", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Game not found." });
    const game = toGame(rows[0]);

    // Served members see full game details only for games they're part of.
    // (allServedView games — e.g. the Card Game — are open to every served member.)
    if (req.user.role === "none") {
      const participant = game.allServedView || (await isServedParticipant(game.id, req.user.id));
      game.participant = participant;
      if (!participant) return res.json({ game });
    }

    if (game.type === "showcase") {
      game.cards = await cardsView(game.id);
      return res.json({ game });
    }

    if (game.type === "survival") {
      const players = await survivalPlayers(game.id);
      game.players = players;
      game.playerCount = players.length;
      game.survivorCount = players.filter((p) => !p.eliminated).length;
      return res.json({ game });
    }

    if (game.type === "rumble") {
      game.ring = await rumbleRing(game.id);
      game.tasks = await rumbleTasks(game.id);
      game.survivorCount = game.ring.filter((tm) => !tm.eliminated).length;
      return res.json({ game });
    }

    if (game.type === "station") {
      game.cards = await cardsView(game.id);
      game.entries = await stationEntries(game.id);
      game.entryCount = game.entries.length;
      if (game.fixturesReady) {
        const { matches, standings } = await playerCompetitionView(game.id, game.format);
        game.matches = matches;
        game.standings = standings;
      } else {
        game.matches = [];
        game.standings = game.format === "league" ? [] : null;
      }
      return res.json({ game });
    }

    if (game.type === "roster") {
      const rosters = await rosterView(game.id);
      game.rosters = rosters;
      game.teamCount = rosters.length;
      if (game.fixturesReady) {
        const { matches, standings } = await competitionView(game.id, game.format);
        game.matches = matches;
        game.standings = standings;
      } else {
        game.matches = [];
        game.standings = game.format === "league" ? [] : null;
      }
      game.scorers = await scorerSheet(game.id);
    } else if (game.type === "players") {
      const players = await playerPool(game.id);
      game.players = players;
      game.playerCount = players.length;
      if (game.fixturesReady) {
        const { matches, standings } = await playerCompetitionView(game.id, game.format);
        game.matches = matches;
        game.standings = standings;
      } else {
        game.matches = [];
        game.standings = game.format === "league" ? [] : null;
      }
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
    const { name, when, description, type, icon, format, teamSize, manager, singlesOnly, allServedView } =
      req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: "Game name is required." });
    const { rows } = await pool.query(
      `INSERT INTO games (id, name, when_text, description, type, icon, format, team_size, manager, singles_only, all_served_view)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        randomUUID(),
        name.trim(),
        (when || "").trim(),
        (description || "").trim(),
        type || "roster",
        icon || "ball",
        format || "league",
        singlesOnly ? 1 : Number(teamSize) === 2 ? 2 : 1,
        (manager || "").trim(),
        !!singlesOnly,
        !!allServedView,
      ]
    );
    res.status(201).json({ game: toGame(rows[0]) });
  } catch (err) {
    next(err);
  }
});

router.put("/:id", requireRole("full"), async (req, res, next) => {
  try {
    const { name, when, description, type, icon, format, teamSize, manager, singlesOnly, allServedView } =
      req.body || {};
    const { rows: existingRows } = await pool.query("SELECT * FROM games WHERE id = $1", [req.params.id]);
    if (!existingRows[0]) return res.status(404).json({ error: "Game not found." });
    const existing = existingRows[0];
    const nextName = name !== undefined ? name.trim() : existing.name;
    const nextWhen = when !== undefined ? when.trim() : existing.when_text;
    const nextDescription = description !== undefined ? description.trim() : existing.description;
    const nextType = type !== undefined ? type : existing.type;
    const nextIcon = icon !== undefined ? icon : existing.icon;
    const nextFormat = format !== undefined ? format : existing.format;
    const nextSinglesOnly = singlesOnly !== undefined ? !!singlesOnly : existing.singles_only;
    const nextAllServed = allServedView !== undefined ? !!allServedView : existing.all_served_view;
    const nextTeamSize = nextSinglesOnly
      ? 1
      : teamSize !== undefined
      ? Number(teamSize) === 2
        ? 2
        : 1
      : existing.team_size;
    const nextManager = manager !== undefined ? manager.trim() : existing.manager;
    const { rows } = await pool.query(
      `UPDATE games SET name = $1, when_text = $2, description = $3, type = $4, icon = $5, format = $6, team_size = $7, manager = $8, singles_only = $9, all_served_view = $10
       WHERE id = $11 RETURNING *`,
      [nextName, nextWhen, nextDescription, nextType, nextIcon, nextFormat, nextTeamSize, nextManager, nextSinglesOnly, nextAllServed, req.params.id]
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
    await resetFixtures(req.params.id);
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
    await resetFixtures(req.params.id);
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

// Add / remove players in a player-game's pool ("seats"). Changing the pool
// clears any generated fixtures so the competition is regenerated cleanly.
router.post("/:id/players", requireRole("full"), async (req, res, next) => {
  try {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: "A member is required." });
    const { rows: userRows } = await pool.query("SELECT id FROM users WHERE id = $1", [userId]);
    if (!userRows[0]) return res.status(404).json({ error: "Member not found." });
    await pool.query(
      "INSERT INTO game_players (id, game_id, user_id) VALUES ($1, $2, $3) ON CONFLICT (game_id, user_id) DO NOTHING",
      [randomUUID(), req.params.id, userId]
    );
    await resetPlayerFixtures(req.params.id);
    res.status(201).json({ players: await playerPool(req.params.id) });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id/players/:userId", requireRole("full"), async (req, res, next) => {
  try {
    await pool.query("DELETE FROM game_players WHERE game_id = $1 AND user_id = $2", [req.params.id, req.params.userId]);
    await resetPlayerFixtures(req.params.id);
    res.json({ players: await playerPool(req.params.id) });
  } catch (err) {
    next(err);
  }
});

// Showcase cards (e.g. the Card Game's Screw / Cochina tiles).
router.post("/:id/cards", requireRole("full"), async (req, res, next) => {
  try {
    const { title, subtitle, art } = req.body || {};
    if (!title || !title.trim()) return res.status(400).json({ error: "A card title is required." });
    const { rows: max } = await pool.query(
      "SELECT COALESCE(MAX(sort), -1) + 1 AS next FROM game_cards WHERE game_id = $1",
      [req.params.id]
    );
    await pool.query(
      "INSERT INTO game_cards (id, game_id, title, subtitle, art, sort) VALUES ($1, $2, $3, $4, $5, $6)",
      [randomUUID(), req.params.id, title.trim(), (subtitle || "").trim(), (art || "card").trim(), max[0].next]
    );
    res.status(201).json({ cards: await cardsView(req.params.id) });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id/cards/:cardId", requireRole("full"), async (req, res, next) => {
  try {
    await pool.query("DELETE FROM game_cards WHERE game_id = $1 AND id = $2", [req.params.id, req.params.cardId]);
    res.json({ cards: await cardsView(req.params.id) });
  } catch (err) {
    next(err);
  }
});

// Play Station entries: add a single (one player) or multi (two players) entry.
// Adding/removing an entry clears any generated fixtures.
router.post("/:id/entries", requireRole("full"), async (req, res, next) => {
  try {
    const playerIds = (req.body?.playerIds || []).filter(Boolean);
    if (playerIds.length < 1 || playerIds.length > 2) {
      return res.status(400).json({ error: "An entry needs one or two players." });
    }
    if (playerIds.length === 2 && playerIds[0] === playerIds[1]) {
      return res.status(400).json({ error: "A multi entry needs two different players." });
    }
    const { rows: users } = await pool.query("SELECT id FROM users WHERE id = ANY($1)", [playerIds]);
    if (users.length !== playerIds.length) return res.status(404).json({ error: "Member not found." });
    await pool.query("INSERT INTO game_pairs (id, game_id, player1_id, player2_id) VALUES ($1, $2, $3, $4)", [
      randomUUID(),
      req.params.id,
      playerIds[0],
      playerIds[1] || null,
    ]);
    await pool.query("DELETE FROM matches WHERE game_id = $1", [req.params.id]);
    await pool.query("UPDATE games SET fixtures_ready = false WHERE id = $1", [req.params.id]);
    res.status(201).json({ entries: await stationEntries(req.params.id) });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id/entries/:pairId", requireRole("full"), async (req, res, next) => {
  try {
    await pool.query("DELETE FROM game_pairs WHERE game_id = $1 AND id = $2", [req.params.id, req.params.pairId]);
    await pool.query("DELETE FROM matches WHERE game_id = $1", [req.params.id]);
    await pool.query("UPDATE games SET fixtures_ready = false WHERE id = $1", [req.params.id]);
    res.json({ entries: await stationEntries(req.params.id) });
  } catch (err) {
    next(err);
  }
});

// Survival games (Squid Game): eliminate / revive a player, or reset the day.
router.put("/:id/survivors/:userId", requireRole("full"), async (req, res, next) => {
  try {
    const eliminated = !!req.body?.eliminated;
    await pool.query("UPDATE game_players SET eliminated = $1 WHERE game_id = $2 AND user_id = $3", [
      eliminated,
      req.params.id,
      req.params.userId,
    ]);
    res.json({ players: await survivalPlayers(req.params.id) });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/survivors/reset", requireRole("full"), async (req, res, next) => {
  try {
    await pool.query("UPDATE game_players SET eliminated = false WHERE game_id = $1", [req.params.id]);
    res.json({ players: await survivalPlayers(req.params.id) });
  } catch (err) {
    next(err);
  }
});

// ---- Royal Rumble: the ring (global teams) ----
router.post("/:id/ring", requireRole("full"), async (req, res, next) => {
  try {
    const { teamId } = req.body || {};
    if (!teamId) return res.status(400).json({ error: "A team is required." });
    const { rows: teamRows } = await pool.query("SELECT id FROM teams WHERE id = $1", [teamId]);
    if (!teamRows[0]) return res.status(404).json({ error: "Team not found." });
    await pool.query(
      "INSERT INTO game_rumble_teams (game_id, team_id) VALUES ($1, $2) ON CONFLICT (game_id, team_id) DO NOTHING",
      [req.params.id, teamId]
    );
    res.status(201).json({ ring: await rumbleRing(req.params.id) });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id/ring/:teamId", requireRole("full"), async (req, res, next) => {
  try {
    await pool.query("DELETE FROM game_rumble_teams WHERE game_id = $1 AND team_id = $2", [
      req.params.id,
      req.params.teamId,
    ]);
    res.json({ ring: await rumbleRing(req.params.id) });
  } catch (err) {
    next(err);
  }
});

router.put("/:id/ring/:teamId", requireRole("full"), async (req, res, next) => {
  try {
    const eliminated = !!req.body?.eliminated;
    await pool.query("UPDATE game_rumble_teams SET eliminated = $1 WHERE game_id = $2 AND team_id = $3", [
      eliminated,
      req.params.id,
      req.params.teamId,
    ]);
    res.json({ ring: await rumbleRing(req.params.id) });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/ring/reset", requireRole("full"), async (req, res, next) => {
  try {
    await pool.query("UPDATE game_rumble_teams SET eliminated = false WHERE game_id = $1", [req.params.id]);
    res.json({ ring: await rumbleRing(req.params.id) });
  } catch (err) {
    next(err);
  }
});

// ---- Royal Rumble: game tasks ----
router.post("/:id/tasks", requireRole("full"), async (req, res, next) => {
  try {
    const { title, instructions, points, durationSeconds } = req.body || {};
    if (!title || !title.trim()) return res.status(400).json({ error: "A task title is required." });
    await pool.query(
      "INSERT INTO game_tasks (id, game_id, title, instructions, points, duration_seconds) VALUES ($1, $2, $3, $4, $5, $6)",
      [
        randomUUID(),
        req.params.id,
        title.trim(),
        (instructions || "").trim(),
        Math.max(0, Number(points) || 0),
        Math.max(0, Number(durationSeconds) || 0),
      ]
    );
    res.status(201).json({ tasks: await rumbleTasks(req.params.id) });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id/tasks/:taskId", requireRole("full"), async (req, res, next) => {
  try {
    await pool.query("DELETE FROM game_tasks WHERE game_id = $1 AND id = $2", [req.params.id, req.params.taskId]);
    res.json({ tasks: await rumbleTasks(req.params.id) });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/tasks/:taskId/launch", requireRole("full"), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "UPDATE game_tasks SET launched_at = now() WHERE game_id = $1 AND id = $2 RETURNING title",
      [req.params.id, req.params.taskId]
    );
    if (!rows[0]) return res.status(404).json({ error: "Task not found." });
    const { rows: g } = await pool.query("SELECT name FROM games WHERE id = $1", [req.params.id]);
    await notify(`${g[0]?.name || "Royal Rumble"}: ${rows[0].title} — started!`, "warning");
    res.json({ tasks: await rumbleTasks(req.params.id) });
  } catch (err) {
    next(err);
  }
});

// Award a task's points to a ring team (adds to that team's global points).
router.post("/:id/tasks/:taskId/award", requireRole("full"), async (req, res, next) => {
  try {
    const { teamId } = req.body || {};
    if (!teamId) return res.status(400).json({ error: "A team is required." });
    const { rows: taskRows } = await pool.query("SELECT title, points FROM game_tasks WHERE game_id = $1 AND id = $2", [
      req.params.id,
      req.params.taskId,
    ]);
    if (!taskRows[0]) return res.status(404).json({ error: "Task not found." });
    const { rows: teamRows } = await pool.query(
      "UPDATE teams SET points = points + $1 WHERE id = $2 RETURNING name",
      [taskRows[0].points, teamId]
    );
    if (!teamRows[0]) return res.status(404).json({ error: "Team not found." });
    await notify(`${teamRows[0].name} +${taskRows[0].points} — ${taskRows[0].title}`, "info");
    res.json({ ring: await rumbleRing(req.params.id) });
  } catch (err) {
    next(err);
  }
});

// Auto-build League or Cup fixtures for a roster (team) or player game.
router.post("/:id/generate", requireRole("full"), async (req, res, next) => {
  try {
    const { format } = req.body || {};
    if (format !== "league" && format !== "cup") {
      return res.status(400).json({ error: "Choose League or Cup." });
    }
    const { rows: gameRows } = await pool.query("SELECT * FROM games WHERE id = $1", [req.params.id]);
    if (!gameRows[0]) return res.status(404).json({ error: "Game not found." });
    const type = gameRows[0].type;

    if (type === "players") {
      const teamSize = Number(req.body?.teamSize) === 2 ? 2 : 1;
      const { rows: cnt } = await pool.query("SELECT COUNT(*)::int AS n FROM game_players WHERE game_id = $1", [
        req.params.id,
      ]);
      const min = teamSize === 2 ? 4 : 2;
      if (cnt[0].n < min) {
        return res.status(400).json({
          error: teamSize === 2 ? "Add at least four players for couples." : "Add at least two players first.",
        });
      }
      await generatePlayerFixtures(req.params.id, format, teamSize);
      const { rows } = await pool.query(
        "UPDATE games SET format = $1, team_size = $2, fixtures_ready = true WHERE id = $3 RETURNING *",
        [format, teamSize, req.params.id]
      );
      const game = toGame(rows[0]);
      game.players = await playerPool(game.id);
      game.playerCount = game.players.length;
      const { matches, standings } = await playerCompetitionView(game.id, game.format);
      game.matches = matches;
      game.standings = standings;
      return res.json({ game });
    }

    if (type === "station") {
      const { rows: cnt } = await pool.query("SELECT COUNT(*)::int AS n FROM game_pairs WHERE game_id = $1", [
        req.params.id,
      ]);
      if (cnt[0].n < 2) return res.status(400).json({ error: "Add at least two entries first." });
      await generateStationFixtures(req.params.id, format);
      const { rows } = await pool.query(
        "UPDATE games SET format = $1, fixtures_ready = true WHERE id = $2 RETURNING *",
        [format, req.params.id]
      );
      const game = toGame(rows[0]);
      game.cards = await cardsView(game.id);
      game.entries = await stationEntries(game.id);
      const { matches, standings } = await playerCompetitionView(game.id, game.format);
      game.matches = matches;
      game.standings = standings;
      return res.json({ game });
    }

    if (type !== "roster") return res.status(400).json({ error: "This game has no fixtures." });
    const { rows: teamRows } = await pool.query("SELECT COUNT(*)::int AS n FROM game_teams WHERE game_id = $1", [
      req.params.id,
    ]);
    if (teamRows[0].n < 2) return res.status(400).json({ error: "Add at least two teams first." });

    await generateFixtures(req.params.id, format);
    const { rows } = await pool.query(
      "UPDATE games SET format = $1, fixtures_ready = true WHERE id = $2 RETURNING *",
      [format, req.params.id]
    );
    const game = toGame(rows[0]);
    const { matches, standings } = await competitionView(game.id, game.format);
    game.matches = matches;
    game.standings = standings;
    game.scorers = await scorerSheet(game.id);
    res.json({ game });
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
    const { rows: gameRows } = await pool.query("SELECT type, format FROM games WHERE id = $1", [req.params.id]);
    if (!gameRows[0]) return res.status(404).json({ error: "Game not found." });
    const game = gameRows[0];

    if (game.type === "roster") return await saveRosterResult(req, res, game);

    if (game.type === "players") {
      const { winnerSide } = req.body || {};
      if (winnerSide === null) {
        await pool.query("UPDATE matches SET status = 'scheduled', winner_side = NULL WHERE id = $1 AND game_id = $2", [
          req.params.matchId,
          req.params.id,
        ]);
      } else {
        if (winnerSide !== "a" && winnerSide !== "b") {
          return res.status(400).json({ error: "A valid winner is required." });
        }
        const { rows: mRows } = await pool.query(
          "SELECT pair_a_id, pair_b_id FROM matches WHERE id = $1 AND game_id = $2",
          [req.params.matchId, req.params.id]
        );
        if (!mRows[0]) return res.status(404).json({ error: "Match not found." });
        if (!mRows[0].pair_a_id || !mRows[0].pair_b_id) {
          return res.status(400).json({ error: "Both sides are needed first." });
        }
        await pool.query("UPDATE matches SET status = 'done', winner_side = $1 WHERE id = $2 AND game_id = $3", [
          winnerSide,
          req.params.matchId,
          req.params.id,
        ]);
      }
      if (game.format === "cup") await recomputePlayerBracket(req.params.id);
      return res.json(await playerCompetitionView(req.params.id, game.format));
    }

    // duel / matchup games: winner-side only (unchanged)
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
    res.json(await matchupView(req.params.id, game.format));
  } catch (err) {
    next(err);
  }
});

// Save a roster (Football) match result: score + goal scorers + cards.
async function saveRosterResult(req, res, game) {
  const gameId = req.params.id;
  const matchId = req.params.matchId;
  const body = req.body || {};

  const { rows: matchRows } = await pool.query("SELECT * FROM matches WHERE id = $1 AND game_id = $2", [
    matchId,
    gameId,
  ]);
  if (!matchRows[0]) return res.status(404).json({ error: "Match not found." });
  const match = matchRows[0];

  // Reset a played result back to unplayed.
  if (body.scoreA === null || body.scoreA === undefined) {
    await pool.query(
      `UPDATE matches SET status = 'scheduled', winner_side = NULL, score_a = NULL, score_b = NULL,
        red_a = 0, yellow_a = 0, red_b = 0, yellow_b = 0 WHERE id = $1`,
      [matchId]
    );
    await pool.query("DELETE FROM match_goals WHERE match_id = $1", [matchId]);
    if (game.format === "cup") await recomputeBracket(gameId);
    return res.json(await withScorers(gameId, game.format));
  }

  const num = (v) => Math.max(0, parseInt(v, 10) || 0);
  const scoreA = num(body.scoreA);
  const scoreB = num(body.scoreB);
  if (game.format === "cup" && scoreA === scoreB) {
    return res.status(400).json({ error: "A cup match must have a winner." });
  }
  const winnerSide = scoreA > scoreB ? "a" : scoreB > scoreA ? "b" : null;

  await pool.query(
    `UPDATE matches SET status = 'done', winner_side = $1, score_a = $2, score_b = $3,
      red_a = $4, yellow_a = $5, red_b = $6, yellow_b = $7 WHERE id = $8`,
    [winnerSide, scoreA, scoreB, num(body.redA), num(body.yellowA), num(body.redB), num(body.yellowB), matchId]
  );

  // Replace this match's goal scorers.
  await pool.query("DELETE FROM match_goals WHERE match_id = $1", [matchId]);
  const scorers = Array.isArray(body.scorers) ? body.scorers : [];
  for (const s of scorers) {
    if (!s || !s.userId || (s.side !== "a" && s.side !== "b")) continue;
    const teamId = s.side === "a" ? match.team_a_id : match.team_b_id;
    await pool.query("INSERT INTO match_goals (id, game_id, match_id, user_id, team_id) VALUES ($1, $2, $3, $4, $5)", [
      randomUUID(),
      gameId,
      matchId,
      s.userId,
      teamId,
    ]);
  }

  if (game.format === "cup") await recomputeBracket(gameId);
  return res.json(await withScorers(gameId, game.format));
}

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
